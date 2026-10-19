import { randomBytes } from 'node:crypto';
import type {
  CheckoutQuoteDto,
  CheckoutSessionDto,
  Paginated,
  PaymentReceiptDto,
  StudentOrderDto,
} from '@asra/types';
import type { StudentOrderListQuery, VerifyPaymentInput } from '@asra/validation';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { Prisma, type Order } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { createStudentRepository } from '../student/student.repository.js';
import { paymentAudit } from './audit.js';
import { paymentsConfig } from './config.js';
import { PaymentGatewayError } from './gateway.js';
import { studentOrderSelect, toStudentOrder } from './mappers.js';
import { NOT_PAYABLE_MESSAGES, priceCourse } from './pricing.js';
import { applyAndNotify, captureIfAuthorized, reconcileOrder } from './reconcile.js';

/**
 * Student checkout (docs/PAYMENTS.md §5–7). The student is always `auth.userId`; the course is
 * the only input. Price, discount, currency and mode come from the server; payment outcome comes
 * from Razorpay. The browser's success callback only triggers verification — it never activates.
 */

const ISSUER = 'ASRA Academy';
/** Minimum spacing between student-triggered provider reads of one order. */
const REFRESH_SPACING_MS = 5_000;

const notFound = (entity: string): never => {
  throw new AppError('NOT_FOUND', `${entity} not found`);
};

/** "ASRA-261019-7KQ2M9XD": date + 8 random Crockford base-32 characters (no I/L/O/U). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newOrderReference(now = clock.now()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = [...randomBytes(8)].map((byte) => ALPHABET[byte % 32]).join('');
  return `ASRA-${date}-${random}`;
}

const courseCheckoutSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  thumbnailUrl: true,
  status: true,
  visibility: true,
  priceMinor: true,
  currency: true,
  discountType: true,
  discountValue: true,
} satisfies Prisma.CourseSelect;

type CheckoutCourseRow = Prisma.CourseGetPayload<{ select: typeof courseCheckoutSelect }>;

async function loadStudentOrder(userId: string, orderId: string) {
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: studentOrderSelect,
  });
  // 404 for someone else's order too: order ids are never confirmed to other users (no IDOR).
  return row ?? notFound('Order');
}

async function toDto(row: Awaited<ReturnType<typeof loadStudentOrder>>): Promise<StudentOrderDto> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: row.userId, courseId: row.courseId } },
    select: { status: true },
  });
  return toStudentOrder(row, enrollment?.status === 'ACTIVE');
}

/** The open order (CREATED/PENDING) of a student for a course, if any. */
function findOpenOrder(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  courseId: string,
) {
  return db.order.findFirst({
    where: { userId, courseId, status: { in: ['CREATED', 'PENDING'] } },
  });
}

/** Same terms as the course's current price, same mode, still within its checkout window. */
function isReusable(
  order: Order,
  price: NonNullable<ReturnType<typeof priceCourse>>,
  mode: string,
) {
  return (
    order.mode === mode &&
    order.amountMinor === price.amountMinor &&
    order.listPriceMinor === price.listPriceMinor &&
    order.currency === price.currency &&
    order.expiresAt > clock.now()
  );
}

/** Course + entitlement checks shared by the quote and order creation. */
function availabilityOf(
  course: CheckoutCourseRow,
  enrollment: { status: 'ACTIVE' | 'CANCELLED' } | null,
) {
  const price = priceCourse(course);
  if (enrollment?.status === 'ACTIVE')
    return { availability: 'ENROLLED' as const, price, message: null };
  if (enrollment?.status === 'CANCELLED') {
    return {
      availability: 'CONTACT_ACADEMY' as const,
      price,
      message: 'Your enrolment in this course was cancelled. Please contact the academy.',
    };
  }
  if (!price) {
    return {
      availability: 'CONTACT_ACADEMY' as const,
      price,
      message: NOT_PAYABLE_MESSAGES.UNPRICED,
    };
  }
  if (price.isFree) return { availability: 'FREE' as const, price, message: null };
  if (!price.payable) {
    return {
      availability: 'NOT_PAYABLE' as const,
      price,
      message: NOT_PAYABLE_MESSAGES[price.notPayableReason!],
    };
  }
  if (!paymentsConfig.checkoutEnabled()) {
    return {
      availability: 'PAYMENTS_DISABLED' as const,
      price,
      message: 'Online payment is not available yet. Please contact the academy to enrol.',
    };
  }
  return { availability: 'PURCHASE' as const, price, message: null };
}

function assertPurchasableCourse(
  course: CheckoutCourseRow | null,
  enrolled: boolean,
): CheckoutCourseRow {
  // Unpublished or PRIVATE (enrolled-only) courses are not disclosed and cannot be bought.
  if (!course || course.status !== 'PUBLISHED') notFound('Course');
  if (course!.visibility === 'PRIVATE' && !enrolled) notFound('Course');
  return course!;
}

const alreadyEnrolled = () =>
  new AppError('CONFLICT', 'You are already enrolled in this course.', {
    reason: 'ALREADY_ENROLLED',
  });

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function gatewayUnavailable(error: unknown, message: string): AppError {
  const { name, kind, providerCode } = error as {
    name?: string;
    kind?: string;
    providerCode?: string;
  };
  logger.warn({ errorName: name, kind, providerCode }, 'Payment provider call failed');
  return new AppError('SERVICE_UNAVAILABLE', message);
}

export const ordersService = {
  /** `GET /student/checkout/:slug` — what the student can do, at the server's price. */
  async quote(auth: AuthContext, slug: string): Promise<CheckoutQuoteDto> {
    const row = await prisma.course.findUnique({ where: { slug }, select: courseCheckoutSelect });
    const enrollment = row
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: auth.userId, courseId: row.id } },
          select: { status: true },
        })
      : null;
    const course = assertPurchasableCourse(row, enrollment?.status === 'ACTIVE');
    const { availability, price, message } = availabilityOf(course, enrollment);
    const mode = paymentsConfig.activeMode();

    let openOrder: StudentOrderDto | null = null;
    if (availability === 'PURCHASE' && price && mode) {
      const open = await findOpenOrder(prisma, auth.userId, course.id);
      if (open?.providerOrderId && isReusable(open, price, mode)) {
        openOrder = await toDto(await loadStudentOrder(auth.userId, open.id));
      }
    }
    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        thumbnailUrl: course.thumbnailUrl,
      },
      availability,
      message,
      price,
      mode: availability === 'PURCHASE' ? mode : null,
      openOrder,
    };
  },

  /**
   * `POST /student/orders` — creates (or resumes) the order and its Razorpay order.
   *
   * Idempotent per student and course: concurrent requests (two tabs, double clicks) resolve to
   * ONE open order (partial unique index) and one provider order. An open order on stale terms
   * is reconciled with Razorpay before it is replaced, so a payment already made on it is never
   * lost or charged twice.
   */
  async createOrder(auth: AuthContext, courseId: string): Promise<CheckoutSessionDto> {
    const account = paymentsConfig.requireActiveAccount();

    // 1. Settle any open order first (outside a transaction: provider calls are slow).
    const previous = await findOpenOrder(prisma, auth.userId, courseId);
    if (previous?.providerOrderId && paymentsConfig.account(previous.mode)) {
      try {
        await reconcileOrder(previous.id);
      } catch (error) {
        // Unknown provider state: replacing the order could double-charge. Only reuse is safe.
        const price = priceCourse(
          (await prisma.course.findUnique({
            where: { id: courseId },
            select: courseCheckoutSelect,
          })) ?? {
            priceMinor: null,
            currency: null,
            discountType: null,
            discountValue: null,
          },
        );
        if (!price || !isReusable(previous, price, account.mode)) {
          throw gatewayUnavailable(
            error,
            'We could not check your previous payment attempt. Please try again in a minute.',
          );
        }
      }
    }

    // 2. Decide, in one short transaction: reuse the open order, or replace it.
    let order: Order;
    for (let attempt = 0; ; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const repo = createStudentRepository(tx);
          if (!(await repo.course.lock(courseId))) notFound('Course');
          const row = await tx.course.findUnique({
            where: { id: courseId },
            select: courseCheckoutSelect,
          });
          const enrollment = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId: auth.userId, courseId } },
            select: { status: true },
          });
          const course = assertPurchasableCourse(row, enrollment?.status === 'ACTIVE');
          const { availability, price, message } = availabilityOf(course, enrollment);
          if (availability === 'ENROLLED') throw alreadyEnrolled();
          if (availability === 'FREE') {
            throw new AppError('CONFLICT', 'This course is free — enrol without payment.', {
              reason: 'FREE_COURSE',
            });
          }
          if (availability !== 'PURCHASE' || !price) {
            throw new AppError('FORBIDDEN', message ?? 'This course cannot be bought online.');
          }

          const open = await findOpenOrder(tx, auth.userId, courseId);
          if (open && isReusable(open, price, account.mode)) return open;
          const now = clock.now();
          if (open) {
            await tx.order.update({
              where: { id: open.id },
              data: { status: 'CANCELLED', cancelledAt: now },
            });
            await paymentAudit(tx, {
              action: 'order.cancelled',
              actorId: auth.userId,
              entityType: 'order',
              entityId: open.id,
              data: { reason: 'superseded' },
            });
          }
          const created = await tx.order.create({
            data: {
              reference: newOrderReference(now),
              userId: auth.userId,
              courseId,
              status: 'CREATED',
              mode: account.mode,
              providerKeyId: account.keyId,
              currency: price.currency,
              courseTitle: course.title,
              listPriceMinor: price.listPriceMinor,
              discountType: price.discountType,
              discountValue: price.discountValue,
              discountMinor: price.discountMinor,
              amountMinor: price.amountMinor,
              expiresAt: new Date(now.getTime() + env.PAYMENT_ORDER_TTL_MINUTES * 60_000),
            },
          });
          await paymentAudit(tx, {
            action: 'order.created',
            actorId: auth.userId,
            entityType: 'order',
            entityId: created.id,
            data: {
              amountMinor: created.amountMinor,
              currency: created.currency,
              mode: created.mode,
            },
          });
          return created;
        });
        break;
      } catch (error) {
        // Another request created the open order between our read and insert → reuse it.
        if (isUniqueViolation(error) && attempt < 2) continue;
        throw error;
      }
    }

    // 3. Create the provider order (once per local order; a lost race reuses the winner's).
    if (!order.providerOrderId) {
      let providerOrder;
      try {
        providerOrder = await account.gateway.createOrder({
          amountMinor: order.amountMinor,
          currency: order.currency,
          receipt: order.reference,
          notes: { orderReference: order.reference, orderId: order.id },
        });
      } catch (error) {
        await prisma.order.update({
          where: { id: order.id },
          data: { failureReason: 'The payment service could not be reached. Please try again.' },
        });
        throw gatewayUnavailable(
          error,
          'The payment service is not responding. Please try again shortly.',
        );
      }
      if (
        providerOrder.amountMinor !== order.amountMinor ||
        providerOrder.currency !== order.currency
      ) {
        throw new AppError('INTERNAL_ERROR', 'The payment order could not be created correctly.');
      }
      const updated = await prisma.order.updateMany({
        where: { id: order.id, providerOrderId: null, status: 'CREATED' },
        data: { providerOrderId: providerOrder.id, status: 'PENDING', failureReason: null },
      });
      if (updated.count === 1) {
        await paymentAudit(prisma, {
          action: 'order.provider_order_created',
          actorId: auth.userId,
          entityType: 'order',
          entityId: order.id,
          data: { providerOrderId: providerOrder.id },
        });
      }
      order = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      if (!order.providerOrderId) {
        throw new AppError('CONFLICT', 'This checkout was closed. Please start again.');
      }
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { fullName: true, email: true },
    });
    return {
      order: await toDto(await loadStudentOrder(auth.userId, order.id)),
      checkout: {
        keyId: account.keyId,
        providerOrderId: order.providerOrderId!,
        amountMinor: order.amountMinor,
        currency: order.currency,
        name: ISSUER,
        description: order.courseTitle.slice(0, 255),
        prefill: { name: user.fullName, email: user.email },
        notes: { orderReference: order.reference },
      },
    };
  },

  /**
   * `POST /student/orders/:id/verify` — the Checkout success callback. Checks ownership, that the
   * echoed provider order is OURS, the signature with the ORDER's mode secret, then re-reads the
   * payment from Razorpay and applies it. Repeating the call is harmless (idempotent).
   */
  async verify(
    auth: AuthContext,
    orderId: string,
    input: VerifyPaymentInput,
  ): Promise<StudentOrderDto> {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId: auth.userId } });
    if (!order) notFound('Order');
    const fail = async (reason: string, message: string): Promise<never> => {
      await paymentAudit(prisma, {
        action: 'payment.verification_failed',
        actorId: auth.userId,
        entityType: 'order',
        entityId: order!.id,
        data: { reason, providerPaymentId: input.razorpayPaymentId },
      });
      throw new AppError('BAD_REQUEST', message, { reason });
    };

    if (!order!.providerOrderId || input.razorpayOrderId !== order!.providerOrderId) {
      return fail('ORDER_MISMATCH', 'This payment does not belong to this order.');
    }
    const account = paymentsConfig.requireAccount(order!.mode);
    if (
      !account.verifyCheckoutSignature(
        order!.providerOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
      )
    ) {
      return fail(
        'INVALID_SIGNATURE',
        'We could not verify this payment. If money was taken, it will be confirmed automatically or refunded.',
      );
    }

    let payment;
    try {
      payment = await account.gateway.fetchPayment(input.razorpayPaymentId);
      if (payment.orderId !== order!.providerOrderId) {
        return fail('PAYMENT_ORDER_MISMATCH', 'This payment does not belong to this order.');
      }
      payment = await captureIfAuthorized(account, order!, payment);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof PaymentGatewayError && error.kind === 'REJECTED') {
        return fail('PAYMENT_NOT_FOUND', 'This payment could not be found.');
      }
      // Signature is valid but Razorpay is unreachable: the order stays pending and is confirmed
      // by the webhook or reconciliation. Nothing is activated from the signature alone.
      throw gatewayUnavailable(
        error,
        'Your payment is being confirmed. Please check the status again in a moment.',
      );
    }
    await applyAndNotify(order!.id, payment, {
      source: 'fetch',
      signatureVerified: true,
      actorId: auth.userId,
    });
    return toDto(await loadStudentOrder(auth.userId, order!.id));
  },

  /**
   * `POST /student/orders/:id/refresh` — "check payment status" (after a closed window, a lost
   * connection or a refresh). Reads Razorpay when the order may still change; spaced per order.
   */
  async refresh(auth: AuthContext, orderId: string): Promise<StudentOrderDto> {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId: auth.userId } });
    if (!order) notFound('Order');
    const recent =
      order!.lastReconciledAt &&
      clock.now().getTime() - order!.lastReconciledAt.getTime() < REFRESH_SPACING_MS;
    if (['CREATED', 'PENDING', 'EXPIRED', 'CANCELLED'].includes(order!.status) && !recent) {
      try {
        await reconcileOrder(order!.id);
      } catch (error) {
        if (error instanceof AppError && error.code !== 'SERVICE_UNAVAILABLE') throw error;
        // Provider unreachable: report the last known state; the worker/webhook will catch up.
        gatewayUnavailable(error, '');
      }
    }
    return toDto(await loadStudentOrder(auth.userId, order!.id));
  },

  async get(auth: AuthContext, orderId: string): Promise<StudentOrderDto> {
    return toDto(await loadStudentOrder(auth.userId, orderId));
  },

  /** The student's own orders, newest first. Never-paid orders show as what they are. */
  async list(auth: AuthContext, query: StudentOrderListQuery): Promise<Paginated<StudentOrderDto>> {
    const where: Prisma.OrderWhereInput = {
      userId: auth.userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total, enrollments] = await Promise.all([
      prisma.order.findMany({
        where,
        select: studentOrderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.order.count({ where }),
      prisma.enrollment.findMany({
        where: { userId: auth.userId, status: 'ACTIVE' },
        select: { courseId: true },
      }),
    ]);
    const active = new Set(enrollments.map((row) => row.courseId));
    return paginated(
      rows.map((row) => toStudentOrder(row, active.has(row.courseId))),
      total,
      query,
    );
  },

  /** Receipt of a PAID order, from verified records only. Never for someone else's order. */
  async receipt(auth: AuthContext, orderId: string): Promise<PaymentReceiptDto> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: auth.userId },
      select: {
        reference: true,
        status: true,
        mode: true,
        courseTitle: true,
        listPriceMinor: true,
        discountMinor: true,
        amountMinor: true,
        currency: true,
        paidAt: true,
        student: { select: { fullName: true, email: true } },
        payments: {
          where: { appliedAt: { not: null }, status: 'CAPTURED' },
          select: { providerPaymentId: true, method: true, refundedMinor: true },
          take: 1,
        },
      },
    });
    if (!order) notFound('Order');
    const payment = order!.payments[0];
    if (order!.status !== 'PAID' || !payment || !order!.paidAt) {
      throw new AppError('NOT_FOUND', 'A receipt is available only for a confirmed payment.');
    }
    const refundedMinor = payment.refundedMinor;
    return {
      receiptNumber: order!.reference,
      orderReference: order!.reference,
      providerPaymentId: payment.providerPaymentId,
      mode: order!.mode,
      issuer: { name: ISSUER },
      student: order!.student,
      course: { title: order!.courseTitle },
      listPriceMinor: order!.listPriceMinor,
      discountMinor: order!.discountMinor,
      amountMinor: order!.amountMinor,
      currency: order!.currency,
      method: payment.method,
      paidAt: order!.paidAt.toISOString(),
      refundedMinor,
      refundState:
        refundedMinor <= 0 ? 'NONE' : refundedMinor >= order!.amountMinor ? 'FULL' : 'PARTIAL',
      isTaxInvoice: false,
    };
  },
};
