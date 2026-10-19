import type {
  AdminOrderListItem,
  AdminPaymentListItem,
  AdminRefundDto,
  OrderNextStep,
  OrderPriceDto,
  RefundState,
  StudentOrderDto,
} from '@asra/types';
import type { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';

/**
 * Prisma selects + DTO mappers for orders, payments and refunds. Student DTOs never include the
 * provider key id, provider order id, audit data or review notes; admin DTOs include what an
 * administrator needs to trace a transaction (provider ids), but never secrets or webhook bodies.
 */

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => date?.toISOString() ?? null;

export const studentOrderSelect = {
  id: true,
  reference: true,
  status: true,
  mode: true,
  userId: true,
  courseId: true,
  currency: true,
  listPriceMinor: true,
  discountType: true,
  discountValue: true,
  discountMinor: true,
  amountMinor: true,
  createdAt: true,
  expiresAt: true,
  paidAt: true,
  failureReason: true,
  course: { select: { id: true, slug: true, title: true } },
  courseTitle: true,
  payments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      currency: true,
      method: true,
      errorDescription: true,
      refundedMinor: true,
      capturedAt: true,
      failedAt: true,
      createdAt: true,
      appliedAt: true,
      refunds: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
          processedAt: true,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

export type StudentOrderRow = Prisma.OrderGetPayload<{ select: typeof studentOrderSelect }>;

export function toOrderPrice(row: {
  currency: string;
  listPriceMinor: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  discountValue: number | null;
  discountMinor: number;
  amountMinor: number;
}): OrderPriceDto {
  return {
    currency: row.currency,
    listPriceMinor: row.listPriceMinor,
    discountType: row.discountType,
    discountValue: row.discountValue,
    discountMinor: row.discountMinor,
    amountMinor: row.amountMinor,
  };
}

export function refundStateOf(refundedMinor: number, amountMinor: number): RefundState {
  if (refundedMinor <= 0) return 'NONE';
  return refundedMinor >= amountMinor ? 'FULL' : 'PARTIAL';
}

export function toStudentOrder(row: StudentOrderRow, enrollmentActive: boolean): StudentOrderDto {
  const applied = row.payments.find((payment) => payment.appliedAt !== null);
  const refundedMinor = applied?.refundedMinor ?? 0;
  const open = row.status === 'CREATED' || row.status === 'PENDING';
  let nextStep: OrderNextStep = 'NONE';
  if (row.status === 'PAID') nextStep = enrollmentActive ? 'OPEN_COURSE' : 'NONE';
  else if (open && row.expiresAt > clock.now()) {
    nextStep = row.payments.some((p) => p.status === 'AUTHORIZED') ? 'WAIT' : 'PAY';
  }
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    mode: row.mode,
    // The title is snapshotted, so the history stays readable if the course is renamed.
    course: { id: row.course.id, slug: row.course.slug, title: row.courseTitle },
    price: toOrderPrice(row),
    createdAt: iso(row.createdAt),
    expiresAt: iso(row.expiresAt),
    paidAt: isoOrNull(row.paidAt),
    failureReason: row.status === 'PAID' ? null : row.failureReason,
    refundState: refundStateOf(refundedMinor, row.amountMinor),
    refundedMinor,
    payments: row.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      method: payment.method,
      failureMessage: payment.status === 'FAILED' ? payment.errorDescription : null,
      refundedMinor: payment.refundedMinor,
      capturedAt: isoOrNull(payment.capturedAt),
      failedAt: isoOrNull(payment.failedAt),
      createdAt: iso(payment.createdAt),
    })),
    refunds: row.payments.flatMap((payment) =>
      payment.refunds.map((refund) => ({
        id: refund.id,
        status: refund.status,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        createdAt: iso(refund.createdAt),
        processedAt: isoOrNull(refund.processedAt),
      })),
    ),
    enrollmentActive,
    receiptAvailable: row.status === 'PAID' && applied !== undefined,
    nextStep,
  };
}

// --- Admin ------------------------------------------------------------------------------------

const party = { select: { id: true, fullName: true, email: true } } as const;
const toParty = (user: { id: string; fullName: string; email: string }) => ({
  userId: user.id,
  fullName: user.fullName,
  email: user.email,
});

export const adminOrderSelect = {
  id: true,
  reference: true,
  status: true,
  mode: true,
  amountMinor: true,
  currency: true,
  createdAt: true,
  paidAt: true,
  courseId: true,
  courseTitle: true,
  student: party,
  payments: { where: { appliedAt: { not: null } }, select: { refundedMinor: true } },
} satisfies Prisma.OrderSelect;

export type AdminOrderRow = Prisma.OrderGetPayload<{ select: typeof adminOrderSelect }>;

export function toAdminOrder(row: AdminOrderRow): AdminOrderListItem {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    mode: row.mode,
    student: toParty(row.student),
    course: { id: row.courseId, title: row.courseTitle },
    amountMinor: row.amountMinor,
    currency: row.currency,
    refundedMinor: row.payments.reduce((sum, p) => sum + p.refundedMinor, 0),
    createdAt: iso(row.createdAt),
    paidAt: isoOrNull(row.paidAt),
  };
}

export const adminPaymentSelect = {
  id: true,
  providerPaymentId: true,
  status: true,
  mode: true,
  orderId: true,
  amountMinor: true,
  currency: true,
  method: true,
  errorCode: true,
  errorDescription: true,
  refundedMinor: true,
  appliedAt: true,
  reviewReason: true,
  capturedAt: true,
  failedAt: true,
  createdAt: true,
  student: party,
  order: { select: { reference: true, courseId: true, courseTitle: true } },
  refunds: {
    where: { status: { in: ['REQUESTED', 'PENDING'] as ('REQUESTED' | 'PENDING')[] } },
    select: { amountMinor: true },
  },
} satisfies Prisma.PaymentSelect;

export type AdminPaymentRow = Prisma.PaymentGetPayload<{ select: typeof adminPaymentSelect }>;

/** Captured − processed − in-flight (REQUESTED/PENDING) refunds. */
export function refundableOf(row: {
  status: string;
  amountMinor: number;
  refundedMinor: number;
  refunds: { amountMinor: number }[];
}): number {
  if (row.status !== 'CAPTURED') return 0;
  const inFlight = row.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0);
  return Math.max(0, row.amountMinor - row.refundedMinor - inFlight);
}

export function toAdminPayment(row: AdminPaymentRow): AdminPaymentListItem {
  return {
    id: row.id,
    providerPaymentId: row.providerPaymentId,
    status: row.status,
    mode: row.mode,
    orderId: row.orderId,
    orderReference: row.order.reference,
    student: toParty(row.student),
    course: { id: row.order.courseId, title: row.order.courseTitle },
    amountMinor: row.amountMinor,
    currency: row.currency,
    method: row.method,
    errorCode: row.errorCode,
    errorDescription: row.errorDescription,
    refundedMinor: row.refundedMinor,
    refundableMinor: refundableOf(row),
    applied: row.appliedAt !== null,
    reviewReason: row.reviewReason,
    capturedAt: isoOrNull(row.capturedAt),
    failedAt: isoOrNull(row.failedAt),
    createdAt: iso(row.createdAt),
  };
}

export const adminRefundSelect = {
  id: true,
  paymentId: true,
  providerRefundId: true,
  mode: true,
  status: true,
  amountMinor: true,
  currency: true,
  reason: true,
  failureReason: true,
  revokedAccess: true,
  createdAt: true,
  processedAt: true,
  requestedBy: { select: { fullName: true } },
  payment: {
    select: {
      providerPaymentId: true,
      orderId: true,
      student: party,
      order: { select: { reference: true, courseId: true, courseTitle: true } },
    },
  },
} satisfies Prisma.RefundSelect;

export type AdminRefundRow = Prisma.RefundGetPayload<{ select: typeof adminRefundSelect }>;

export function toAdminRefund(row: AdminRefundRow): AdminRefundDto {
  return {
    id: row.id,
    paymentId: row.paymentId,
    providerPaymentId: row.payment.providerPaymentId,
    providerRefundId: row.providerRefundId,
    orderId: row.payment.orderId,
    orderReference: row.payment.order.reference,
    student: toParty(row.payment.student),
    course: { id: row.payment.order.courseId, title: row.payment.order.courseTitle },
    mode: row.mode,
    status: row.status,
    amountMinor: row.amountMinor,
    currency: row.currency,
    reason: row.reason,
    failureReason: row.failureReason,
    requestedBy: row.requestedBy?.fullName ?? null,
    revokedAccess: row.revokedAccess,
    createdAt: iso(row.createdAt),
    processedAt: isoOrNull(row.processedAt),
  };
}
