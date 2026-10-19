import { prisma } from '../../database/prisma.js';
import { clock } from '../../lib/clock.js';
import type { Order, PaymentStatus, Prisma, RefundStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { createStudentRepository } from '../student/student.repository.js';
import { paymentAudit } from './audit.js';
import type { ProviderPayment, ProviderRefund } from './gateway.js';

/**
 * The authoritative payment → enrolment state machine (docs/PAYMENTS.md §8–9).
 *
 * `applyProviderPayment` is the ONE function that records a provider payment and activates a paid
 * enrolment. It is called by Checkout verification, webhooks and reconciliation alike, always with
 * data read from Razorpay (a signed webhook or an authenticated API fetch) — never with anything the
 * browser asserted. It runs in a short database transaction (no provider call inside it), locks the
 * order row, and is idempotent: applying the same captured payment twice changes nothing and
 * reports `justPaid: false` the second time, so callers send notifications exactly once.
 */

type Tx = Prisma.TransactionClient;

const PAYMENT_RANK: Record<PaymentStatus, number> = {
  CREATED: 0,
  FAILED: 1,
  AUTHORIZED: 2,
  CAPTURED: 3,
};

const REFUND_RANK: Record<RefundStatus, number> = {
  REQUESTED: 0,
  PENDING: 1,
  FAILED: 2,
  PROCESSED: 3,
};

/** Razorpay status → ours. A payment refunded without ever being captured was never ours. */
export function toPaymentStatus(payment: ProviderPayment): PaymentStatus {
  if (payment.captured || payment.status === 'captured') return 'CAPTURED';
  switch (payment.status) {
    case 'authorized':
      return 'AUTHORIZED';
    case 'failed':
    case 'refunded': // authorised, never captured, returned to the customer by Razorpay
      return 'FAILED';
    default:
      return 'CREATED';
  }
}

/**
 * Monotonic transitions. CAPTURED is final. A WEBHOOK snapshot may arrive late or out of order,
 * so it only ever moves a payment forward (a stale `payment.failed` never overrides an
 * authorisation). A direct API fetch is the provider's CURRENT state and may also move an
 * AUTHORIZED payment to FAILED (authorisation expired and was returned).
 */
export function nextPaymentStatus(
  current: PaymentStatus,
  incoming: PaymentStatus,
  source: 'webhook' | 'fetch',
): PaymentStatus {
  if (current === 'CAPTURED') return 'CAPTURED';
  if (source === 'fetch' && current === 'AUTHORIZED' && incoming === 'FAILED') return 'FAILED';
  return PAYMENT_RANK[incoming] > PAYMENT_RANK[current] ? incoming : current;
}

export function nextRefundStatus(current: RefundStatus, incoming: RefundStatus): RefundStatus {
  return REFUND_RANK[incoming] > REFUND_RANK[current] ? incoming : current;
}

async function lockOrder(tx: Tx, orderId: string): Promise<Order> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'Order not found');
  return tx.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Student-safe text for a failed attempt (provider descriptions are customer-facing). */
function failureText(payment: ProviderPayment): string {
  return (payment.errorDescription ?? 'The payment did not go through.').slice(0, 500);
}

export type ActivationResult = 'ACTIVATED' | 'ALREADY_ACTIVE';

/**
 * Creates or reactivates the student's enrolment for a PAID order. Serialised per course with the
 * same course-row lock as free and admin enrolment, and guarded by UNIQUE(user, course), so no
 * sequence of callbacks, webhooks or tabs can create a second enrolment.
 */
async function activateEnrollment(tx: Tx, order: Order, now: Date): Promise<ActivationResult> {
  const repo = createStudentRepository(tx);
  await repo.course.lock(order.courseId);
  const existing = await tx.enrollment.findUnique({
    where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
    select: { id: true, status: true, orderId: true },
  });
  if (existing?.status === 'ACTIVE') {
    return existing.orderId === order.id ? 'ACTIVATED' : 'ALREADY_ACTIVE';
  }
  if (existing) {
    await tx.enrollment.update({
      where: { id: existing.id },
      data: {
        status: 'ACTIVE',
        source: 'PAYMENT',
        orderId: order.id,
        enrolledById: null,
        enrolledAt: now,
        cancelledAt: null,
      },
    });
  } else {
    await tx.enrollment.create({
      data: {
        userId: order.userId,
        courseId: order.courseId,
        status: 'ACTIVE',
        source: 'PAYMENT',
        orderId: order.id,
        enrolledAt: now,
      },
    });
  }
  return 'ACTIVATED';
}

export interface ApplyPaymentResult {
  orderStatus: Order['status'];
  paymentId: string;
  paymentStatus: PaymentStatus;
  /** True only for the single call that moved the order to PAID (→ send the confirmation once). */
  justPaid: boolean;
  needsReview: boolean;
}

/**
 * Records one provider payment of `orderId` and, when it is captured and matches the order,
 * marks the order PAID and activates the enrolment — all in one transaction.
 */
export async function applyProviderPayment(
  orderId: string,
  payment: ProviderPayment,
  options: { source: 'webhook' | 'fetch'; signatureVerified?: boolean; actorId?: string | null },
): Promise<ApplyPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const now = clock.now();
    if (!order.providerOrderId || payment.orderId !== order.providerOrderId) {
      // Callers resolve the order FROM the provider order id; reaching this is a programming or
      // data error, never something to "fix" by attaching the payment anyway.
      throw new AppError('CONFLICT', 'The payment does not belong to this order.');
    }
    const incoming = toPaymentStatus(payment);
    const matches =
      payment.amountMinor === order.amountMinor && payment.currency === order.currency;

    const existing = await tx.payment.findUnique({
      where: {
        provider_providerPaymentId: { provider: order.provider, providerPaymentId: payment.id },
      },
    });
    if (existing && existing.orderId !== order.id) {
      throw new AppError('CONFLICT', 'The payment does not belong to this order.');
    }
    const status = existing
      ? nextPaymentStatus(existing.status, incoming, options.source)
      : incoming;
    const captured = status === 'CAPTURED';
    let reviewReason = existing?.reviewReason ?? null;
    if (captured && !matches) {
      reviewReason = 'Captured amount or currency does not match the order.';
    }

    const data = {
      status,
      method: payment.method?.slice(0, 30) ?? existing?.method ?? null,
      errorCode:
        status === 'FAILED'
          ? (payment.errorCode?.slice(0, 100) ?? null)
          : (existing?.errorCode ?? null),
      errorDescription:
        status === 'FAILED' ? failureText(payment) : (existing?.errorDescription ?? null),
      authorizedAt: existing?.authorizedAt ?? (status === 'AUTHORIZED' || captured ? now : null),
      capturedAt: existing?.capturedAt ?? (captured ? now : null),
      failedAt: status === 'FAILED' ? (existing?.failedAt ?? now) : (existing?.failedAt ?? null),
      refundedMinor: captured
        ? Math.min(
            payment.amountMinor,
            Math.max(existing?.refundedMinor ?? 0, payment.amountRefundedMinor),
          )
        : 0,
      ...(options.signatureVerified && !existing?.signatureVerifiedAt
        ? { signatureVerifiedAt: now }
        : {}),
    };
    const row = existing
      ? await tx.payment.update({ where: { id: existing.id }, data: { ...data, reviewReason } })
      : await tx.payment.create({
          data: {
            ...data,
            reviewReason,
            orderId: order.id,
            userId: order.userId,
            provider: order.provider,
            mode: order.mode,
            providerPaymentId: payment.id,
            providerOrderId: payment.orderId,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
          },
        });
    if (!existing) {
      await paymentAudit(tx, {
        action: 'payment.recorded',
        actorId: options.actorId,
        entityType: 'payment',
        entityId: row.id,
        data: { orderId: order.id, providerPaymentId: payment.id, status, via: options.source },
      });
    }

    let justPaid = false;
    if (captured && matches && order.status !== 'PAID') {
      // Honoured even for a CANCELLED/EXPIRED order: the provider took the money for it.
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: now, failureReason: null },
      });
      const activation = await activateEnrollment(tx, order, now);
      await tx.payment.update({
        where: { id: row.id },
        data: {
          appliedAt: now,
          ...(activation === 'ALREADY_ACTIVE'
            ? { reviewReason: 'The student was already enrolled when this payment was captured.' }
            : {}),
        },
      });
      reviewReason =
        activation === 'ALREADY_ACTIVE'
          ? 'The student was already enrolled when this payment was captured.'
          : reviewReason;
      await paymentAudit(tx, {
        action: 'order.paid',
        actorId: options.actorId,
        entityType: 'order',
        entityId: order.id,
        data: {
          paymentId: row.id,
          amountMinor: order.amountMinor,
          previousStatus: order.status,
          via: options.source,
        },
      });
      await paymentAudit(tx, {
        action: activation === 'ACTIVATED' ? 'enrollment.activated' : 'enrollment.already_active',
        actorId: options.actorId,
        entityType: 'order',
        entityId: order.id,
        data: { courseId: order.courseId, userId: order.userId },
      });
      justPaid = true;
    } else if (captured && !row.appliedAt && !reviewReason) {
      // A second captured payment for an order another payment already paid.
      reviewReason =
        'The order was already paid by another payment. Refund this duplicate payment.';
      await tx.payment.update({ where: { id: row.id }, data: { reviewReason } });
    } else if (status === 'FAILED' && order.status === 'PENDING') {
      await tx.order.update({
        where: { id: order.id },
        data: { failureReason: failureText(payment) },
      });
    }

    if (reviewReason && reviewReason !== existing?.reviewReason) {
      await paymentAudit(tx, {
        action: 'payment.needs_review',
        actorId: options.actorId,
        entityType: 'payment',
        entityId: row.id,
        data: { reason: reviewReason },
      });
    }

    return {
      orderStatus: justPaid ? 'PAID' : order.status,
      paymentId: row.id,
      paymentStatus: status,
      justPaid,
      needsReview: Boolean(reviewReason),
    };
  });
}

const PROVIDER_REFUND_STATUS: Record<ProviderRefund['status'], RefundStatus> = {
  pending: 'PENDING',
  processed: 'PROCESSED',
  failed: 'FAILED',
};

export interface ApplyRefundResult {
  refundId: string;
  status: RefundStatus;
  /** True only for the single call that recorded the refund as PROCESSED (→ notify once). */
  justProcessed: boolean;
}

/** Recomputes `payments.refunded_minor` from the PROCESSED refunds (never double counts). */
export async function recomputeRefunded(tx: Tx, paymentId: string, providerRefundedMinor = 0) {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const sum = await tx.refund.aggregate({
    where: { paymentId, status: 'PROCESSED' },
    _sum: { amountMinor: true },
  });
  const refundedMinor = Math.min(
    payment.amountMinor,
    Math.max(sum._sum.amountMinor ?? 0, providerRefundedMinor),
  );
  if (refundedMinor !== payment.refundedMinor) {
    await tx.payment.update({ where: { id: paymentId }, data: { refundedMinor } });
  }
}

/**
 * Records a refund read from Razorpay (webhook or fetch) against our payment `paymentId`. Matches
 * our own REQUESTED row by provider id or receipt; a refund issued in the Razorpay Dashboard is
 * recorded as a new row without a requesting administrator.
 */
export async function applyProviderRefund(
  paymentId: string,
  refund: ProviderRefund,
  options: { actorId?: string | null } = {},
): Promise<ApplyRefundResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (refund.paymentId !== payment.providerPaymentId) {
      throw new AppError('CONFLICT', 'The refund does not belong to this payment.');
    }
    const incoming = PROVIDER_REFUND_STATUS[refund.status];
    const now = clock.now();

    const existing =
      (await tx.refund.findUnique({ where: { providerRefundId: refund.id } })) ??
      (refund.receipt
        ? await tx.refund.findFirst({ where: { receipt: refund.receipt, paymentId } })
        : null);

    let row;
    let justProcessed = false;
    if (existing) {
      const status = nextRefundStatus(existing.status, incoming);
      justProcessed = status === 'PROCESSED' && existing.status !== 'PROCESSED';
      row = await tx.refund.update({
        where: { id: existing.id },
        data: {
          providerRefundId: refund.id,
          status,
          ...(justProcessed ? { processedAt: now } : {}),
          ...(status === 'FAILED' && existing.status !== 'FAILED'
            ? { failureReason: 'The refund failed at the payment provider.' }
            : {}),
        },
      });
      if (row.status !== existing.status) {
        await paymentAudit(tx, {
          action: 'refund.updated',
          actorId: options.actorId,
          entityType: 'refund',
          entityId: row.id,
          data: { from: existing.status, to: row.status },
        });
      }
    } else {
      justProcessed = incoming === 'PROCESSED';
      row = await tx.refund.create({
        data: {
          paymentId,
          provider: payment.provider,
          mode: payment.mode,
          providerRefundId: refund.id,
          amountMinor: refund.amountMinor,
          currency: refund.currency,
          status: incoming,
          reason: 'Issued outside the platform (Razorpay Dashboard).',
          ...(justProcessed ? { processedAt: now } : {}),
        },
      });
      await paymentAudit(tx, {
        action: 'refund.discovered',
        actorId: options.actorId,
        entityType: 'refund',
        entityId: row.id,
        data: {
          paymentId,
          providerRefundId: refund.id,
          amountMinor: refund.amountMinor,
          status: incoming,
        },
      });
    }
    await recomputeRefunded(tx, paymentId);
    return { refundId: row.id, status: row.status, justProcessed };
  });
}

/** Marks an unpaid order EXPIRED (it can still be honoured if a captured payment shows up later). */
export async function expireOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!['CREATED', 'PENDING'].includes(order.status)) return false;
    const live = await tx.payment.count({
      where: { orderId, status: { in: ['AUTHORIZED', 'CAPTURED'] } },
    });
    if (live > 0) return false;
    await tx.order.update({ where: { id: orderId }, data: { status: 'EXPIRED' } });
    await paymentAudit(tx, { action: 'order.expired', entityType: 'order', entityId: orderId });
    return true;
  });
}
