import {
  PERMISSIONS,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminPaymentListItem,
  type AdminPaymentsConfigDto,
  type AdminRefundDto,
  type Paginated,
  type PaymentSummaryDto,
} from '@asra/types';
import type {
  AdminOrderListQuery,
  AdminPaymentListQuery,
  AdminRefundListQuery,
  PaymentSummaryQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { PaymentMode, Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { paymentsConfig } from './config.js';
import {
  adminOrderSelect,
  adminPaymentSelect,
  adminRefundSelect,
  toAdminOrder,
  toAdminPayment,
  toAdminRefund,
  toOrderPrice,
} from './mappers.js';
import { reconcileOrder } from './reconcile.js';

/**
 * Financial administration (docs/PAYMENTS.md §13). Read-only views require `payments.view`;
 * refunds require `payments.refund` (refunds.service.ts). Every figure is computed from persisted,
 * provider-confirmed rows — never from order totals or anything a browser sent — and always for
 * ONE mode, so test transactions can never appear as live revenue.
 */

/** `from`/`to` are inclusive UTC days. */
function dayRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
  };
}

function studentSearch(q: string | undefined): Prisma.UserWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ],
  };
}

/** Default mode of admin views: the active mode, else LIVE (never a silent mix of both). */
const defaultMode = (mode?: PaymentMode): PaymentMode =>
  mode ?? paymentsConfig.activeMode() ?? 'LIVE';

export const paymentsAdminService = {
  config(auth: AuthContext): AdminPaymentsConfigDto {
    return {
      activeMode: paymentsConfig.activeMode(),
      checkoutEnabled: paymentsConfig.checkoutEnabled(),
      modes: paymentsConfig.describe(),
      canRefund: auth.permissions.has(PERMISSIONS.PAYMENTS_REFUND),
    };
  },

  /**
   * Definitions (shown on the admin screen):
   *  - gross   = Σ amount of payments CAPTURED in the period (one row per provider payment, so
   *              duplicate webhooks or reconciliations can never count a payment twice);
   *  - refunded = Σ amount of refunds PROCESSED in the period;
   *  - net     = gross − refunded (before Razorpay fees/taxes, which the platform does not know).
   */
  async summary(query: PaymentSummaryQuery): Promise<PaymentSummaryDto> {
    const mode = defaultMode(query.mode);
    const range = dayRange(query.from, query.to);
    const course = query.courseId ? { order: { courseId: query.courseId } } : {};

    const [
      captured,
      refunded,
      paidOrderCount,
      pendingOrderCount,
      failedPaymentCount,
      needsReviewCount,
      openRefundCount,
    ] = await Promise.all([
      prisma.payment.groupBy({
        by: ['currency'],
        where: { mode, status: 'CAPTURED', ...(range ? { capturedAt: range } : {}), ...course },
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      prisma.refund.groupBy({
        by: ['currency'],
        where: {
          mode,
          status: 'PROCESSED',
          ...(range ? { processedAt: range } : {}),
          ...(query.courseId ? { payment: { order: { courseId: query.courseId } } } : {}),
        },
        _sum: { amountMinor: true },
      }),
      prisma.order.count({
        where: {
          mode,
          status: 'PAID',
          ...(range ? { paidAt: range } : {}),
          ...(query.courseId ? { courseId: query.courseId } : {}),
        },
      }),
      prisma.order.count({
        where: {
          mode,
          status: { in: ['CREATED', 'PENDING'] },
          ...(range ? { createdAt: range } : {}),
          ...(query.courseId ? { courseId: query.courseId } : {}),
        },
      }),
      prisma.payment.count({
        where: { mode, status: 'FAILED', ...(range ? { failedAt: range } : {}), ...course },
      }),
      prisma.payment.count({
        where: { mode, status: 'CAPTURED', reviewReason: { not: null }, ...course },
      }),
      prisma.refund.count({
        where: {
          mode,
          status: { in: ['REQUESTED', 'PENDING'] },
          ...(query.courseId ? { payment: { order: { courseId: query.courseId } } } : {}),
        },
      }),
    ]);

    const refundedBy = new Map(refunded.map((row) => [row.currency, row._sum.amountMinor ?? 0]));
    const currencies = new Set([...captured.map((row) => row.currency), ...refundedBy.keys()]);
    const totals = [...currencies].sort().map((currency) => {
      const row = captured.find((item) => item.currency === currency);
      const grossCapturedMinor = row?._sum.amountMinor ?? 0;
      const refundedMinor = refundedBy.get(currency) ?? 0;
      return {
        currency,
        grossCapturedMinor,
        refundedMinor,
        netMinor: grossCapturedMinor - refundedMinor,
        capturedPaymentCount: row?._count._all ?? 0,
      };
    });
    return {
      mode,
      from: query.from ?? null,
      to: query.to ?? null,
      totals,
      paidOrderCount,
      pendingOrderCount,
      failedPaymentCount,
      needsReviewCount,
      openRefundCount,
    };
  },

  async orders(query: AdminOrderListQuery): Promise<Paginated<AdminOrderListItem>> {
    const range = dayRange(query.from, query.to);
    const student = studentSearch(query.q);
    const where: Prisma.OrderWhereInput = {
      mode: defaultMode(query.mode),
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(query.q
        ? { OR: [{ reference: { contains: query.q, mode: 'insensitive' } }, { student }] }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: adminOrderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);
    return paginated(rows.map(toAdminOrder), total, query);
  },

  async order(id: string): Promise<AdminOrderDetail> {
    const row = await prisma.order.findUnique({
      where: { id },
      select: {
        ...adminOrderSelect,
        providerOrderId: true,
        listPriceMinor: true,
        discountType: true,
        discountValue: true,
        discountMinor: true,
        expiresAt: true,
        cancelledAt: true,
        failureReason: true,
        lastReconciledAt: true,
        reconcileAttempts: true,
        confirmationEmailSentAt: true,
        userId: true,
      },
    });
    if (!row) throw new AppError('NOT_FOUND', 'Order not found');
    const [payments, refunds, enrollment, audit] = await Promise.all([
      prisma.payment.findMany({
        where: { orderId: id },
        select: adminPaymentSelect,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.refund.findMany({
        where: { payment: { orderId: id } },
        select: adminRefundSelect,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: row.userId, courseId: row.courseId } },
        select: { id: true, status: true, source: true, enrolledAt: true },
      }),
      prisma.paymentAuditLog.findMany({
        where: { OR: [{ entityType: 'order', entityId: id }] },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          action: true,
          createdAt: true,
          data: true,
          actor: { select: { fullName: true } },
        },
      }),
    ]);
    const paymentAudit = payments.length
      ? await prisma.paymentAuditLog.findMany({
          where: {
            OR: [
              { entityType: 'payment', entityId: { in: payments.map((p) => p.id) } },
              ...(refunds.length
                ? [{ entityType: 'refund', entityId: { in: refunds.map((r) => r.id) } }]
                : []),
            ],
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: {
            action: true,
            createdAt: true,
            data: true,
            actor: { select: { fullName: true } },
          },
        })
      : [];
    return {
      ...toAdminOrder(row),
      providerOrderId: row.providerOrderId,
      price: toOrderPrice({ ...row, currency: row.currency, amountMinor: row.amountMinor }),
      expiresAt: row.expiresAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      failureReason: row.failureReason,
      lastReconciledAt: row.lastReconciledAt?.toISOString() ?? null,
      reconcileAttempts: row.reconcileAttempts,
      confirmationEmailSentAt: row.confirmationEmailSentAt?.toISOString() ?? null,
      enrollment: enrollment
        ? { ...enrollment, enrolledAt: enrollment.enrolledAt.toISOString() }
        : null,
      payments: payments.map(toAdminPayment),
      refunds: refunds.map(toAdminRefund),
      audit: [...audit, ...paymentAudit]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((entry) => ({
          action: entry.action,
          actor: entry.actor?.fullName ?? null,
          createdAt: entry.createdAt.toISOString(),
          data: (entry.data as Record<string, unknown> | null) ?? null,
        })),
    };
  },

  async payments(query: AdminPaymentListQuery): Promise<Paginated<AdminPaymentListItem>> {
    const range = dayRange(query.from, query.to);
    const student = studentSearch(query.q);
    const where: Prisma.PaymentWhereInput = {
      mode: defaultMode(query.mode),
      ...(query.status ? { status: query.status } : {}),
      ...(query.needsReview ? { status: 'CAPTURED', reviewReason: { not: null } } : {}),
      ...(query.courseId ? { order: { courseId: query.courseId } } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(query.q
        ? {
            OR: [
              { providerPaymentId: { contains: query.q, mode: 'insensitive' } },
              { order: { reference: { contains: query.q, mode: 'insensitive' } } },
              { student },
            ],
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        select: adminPaymentSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);
    return paginated(rows.map(toAdminPayment), total, query);
  },

  async refunds(query: AdminRefundListQuery): Promise<Paginated<AdminRefundDto>> {
    const range = dayRange(query.from, query.to);
    const student = studentSearch(query.q);
    const where: Prisma.RefundWhereInput = {
      mode: defaultMode(query.mode),
      ...(query.status ? { status: query.status } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(query.courseId || query.q
        ? {
            payment: {
              ...(query.courseId ? { order: { courseId: query.courseId } } : {}),
              ...(query.q
                ? {
                    OR: [
                      { order: { reference: { contains: query.q, mode: 'insensitive' } } },
                      { student },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        select: adminRefundSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.refund.count({ where }),
    ]);
    return paginated(rows.map(toAdminRefund), total, query);
  },

  /** Admin "Reconcile now": re-read the order from Razorpay (audited). */
  async reconcile(auth: AuthContext, id: string): Promise<AdminOrderDetail> {
    if (!(await prisma.order.findUnique({ where: { id }, select: { id: true } }))) {
      throw new AppError('NOT_FOUND', 'Order not found');
    }
    await reconcileOrder(id, { actorId: auth.userId });
    return paymentsAdminService.order(id);
  },
};
