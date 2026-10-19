import { z } from 'zod';
import { booleanQuerySchema, paginationQuerySchema, searchQuerySchema } from './common.js';

/**
 * Enrolment & payment (PHASE 10) request schemas, shared by the API and the web app.
 *
 * Bodies are `.strict()`: a client can never post an amount, a currency, a discount, a payment
 * status or a user id — the server derives all of them. The Razorpay identifiers accepted from the
 * browser are only CLAIMS; the server verifies the signature and re-reads the payment from Razorpay.
 */

export const PAYMENT_MODES = ['TEST', 'LIVE'] as const;
export const ORDER_STATUSES = ['CREATED', 'PENDING', 'PAID', 'CANCELLED', 'EXPIRED'] as const;
export const PAYMENT_STATUSES = ['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED'] as const;
export const REFUND_STATUSES = ['REQUESTED', 'PENDING', 'PROCESSED', 'FAILED'] as const;

/** Razorpay ids: `order_…`, `pay_…` (alphanumeric suffix). */
const providerId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`), 'Invalid payment reference');

/** `POST /student/orders` — start (or resume) checkout for one course. */
export const createOrderSchema = z.object({ courseId: z.uuid() }).strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** `POST /student/orders/:id/verify` — the Razorpay Checkout success callback, verbatim. */
export const verifyPaymentSchema = z
  .object({
    razorpayOrderId: providerId('order'),
    razorpayPaymentId: providerId('pay'),
    razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid payment signature'),
  })
  .strict();

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

/** `GET /student/orders` — the student's own order/payment history. */
export const studentOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
});

export type StudentOrderListQuery = z.infer<typeof studentOrderListQuerySchema>;

/** `YYYY-MM-DD` (inclusive day, interpreted in UTC by the API). */
const dayQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date')
  .optional();

const adminFinanceFilters = {
  mode: z.enum(PAYMENT_MODES).optional(),
  courseId: z.uuid().optional(),
  from: dayQuerySchema,
  to: dayQuerySchema,
};

/** `GET /admin/payments/orders` */
export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  ...adminFinanceFilters,
  q: searchQuerySchema,
  status: z.enum(ORDER_STATUSES).optional(),
});

export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

/** `GET /admin/payments/transactions` — provider payments (attempts). */
export const adminPaymentListQuerySchema = paginationQuerySchema.extend({
  ...adminFinanceFilters,
  q: searchQuerySchema,
  status: z.enum(PAYMENT_STATUSES).optional(),
  /** Captured payments that need an administrator (e.g. paid twice, amount mismatch). */
  needsReview: booleanQuerySchema,
});

export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;

/** `GET /admin/payments/refunds` */
export const adminRefundListQuerySchema = paginationQuerySchema.extend({
  ...adminFinanceFilters,
  q: searchQuerySchema,
  status: z.enum(REFUND_STATUSES).optional(),
});

export type AdminRefundListQuery = z.infer<typeof adminRefundListQuerySchema>;

/** `GET /admin/payments/summary` — one mode at a time, so test money is never added to live. */
export const paymentSummaryQuerySchema = z.object(adminFinanceFilters);

export type PaymentSummaryQuery = z.infer<typeof paymentSummaryQuerySchema>;

/** Razorpay's minimum transaction/refund amount for INR is ₹1 (100 paise). */
export const MIN_PAYMENT_MINOR = 100;

/**
 * `POST /admin/payments/transactions/:id/refunds`. `amountMinor` omitted = the whole remaining
 * refundable balance. `idempotencyKey` (one per click) makes a retried request return the same
 * refund instead of refunding twice.
 */
export const refundCreateSchema = z
  .object({
    amountMinor: z
      .number()
      .int('Amount must be a whole number of paise')
      .min(MIN_PAYMENT_MINOR, 'The minimum refund is ₹1.00')
      .optional(),
    reason: z.string().trim().min(3, 'Give a short reason').max(500),
    /** Also cancel the student's course enrolment (never implied by a refund — N-03 pending). */
    revokeAccess: z.boolean().default(false),
    idempotencyKey: z.uuid(),
  })
  .strict();

export type RefundCreateInput = z.infer<typeof refundCreateSchema>;
