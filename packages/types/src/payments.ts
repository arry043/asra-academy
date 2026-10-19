/**
 * Response shapes of the PHASE 10 enrolment & payment endpoints (docs/PAYMENTS.md).
 * Money is always an integer in the currency's MINOR unit (paise for INR) plus an ISO 4217 code;
 * clients format it for display and never compute prices. Timestamps are ISO-8601 strings.
 * No type here ever carries a provider secret, a webhook payload or card details.
 */

export type PaymentMode = 'TEST' | 'LIVE';
export type OrderStatus = 'CREATED' | 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
export type RefundStatus = 'REQUESTED' | 'PENDING' | 'PROCESSED' | 'FAILED';
/** Derived from the processed refunds of an order's captured payment(s). */
export type RefundState = 'NONE' | 'PARTIAL' | 'FULL';
export type DiscountKind = 'PERCENTAGE' | 'FIXED_AMOUNT';

/** Why a priced course cannot be bought online (shown to the student; no internal detail). */
export type NotPayableReason =
  | 'UNPRICED'
  | 'FREE'
  | 'ZERO_AFTER_DISCOUNT'
  | 'BELOW_MINIMUM'
  | 'UNSUPPORTED_CURRENCY'
  | 'INVALID_PRICE';

/** The server's price calculation for a course right now (docs/PAYMENTS.md §4). */
export interface CoursePriceDto {
  currency: string;
  listPriceMinor: number;
  discountType: DiscountKind | null;
  discountValue: number | null;
  discountMinor: number;
  amountMinor: number;
  isFree: boolean;
  payable: boolean;
  notPayableReason: NotPayableReason | null;
}

/** Price frozen on an order when it was created. */
export interface OrderPriceDto {
  currency: string;
  listPriceMinor: number;
  discountType: DiscountKind | null;
  discountValue: number | null;
  discountMinor: number;
  amountMinor: number;
}

/**
 * What the checkout page can do for this student and course:
 * - ENROLLED: already has access → open the course.
 * - FREE: free enrolment (no payment, no order).
 * - PURCHASE: pay online.
 * - PAYMENTS_DISABLED: priced, but online checkout is not configured on this deployment.
 * - NOT_PAYABLE: priced, but not payable online (see `price.notPayableReason`) → contact.
 * - CONTACT_ACADEMY: no price, PRIVATE/archived course, or a cancelled enrolment.
 */
export type CheckoutAvailability =
  'ENROLLED' | 'FREE' | 'PURCHASE' | 'PAYMENTS_DISABLED' | 'NOT_PAYABLE' | 'CONTACT_ACADEMY';

export interface CheckoutCourseDto {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
}

/** `GET /student/checkout/:slug` */
export interface CheckoutQuoteDto {
  course: CheckoutCourseDto;
  availability: CheckoutAvailability;
  /** Student-facing explanation for every availability other than PURCHASE/ENROLLED/FREE. */
  message: string | null;
  price: CoursePriceDto | null;
  /** Mode new orders are created in, or null when checkout is disabled. */
  mode: PaymentMode | null;
  /** An unpaid order the student can resume (same price), if any. */
  openOrder: StudentOrderDto | null;
}

/** Values Razorpay Checkout needs in the browser — public by design (no secrets). */
export interface RazorpayCheckoutOptions {
  keyId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  notes: { orderReference: string };
}

/** `POST /student/orders` */
export interface CheckoutSessionDto {
  order: StudentOrderDto;
  checkout: RazorpayCheckoutOptions;
}

export interface StudentPaymentDto {
  id: string;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  method: string | null;
  /** Safe provider description of a failure, e.g. "Payment was cancelled by the bank". */
  failureMessage: string | null;
  refundedMinor: number;
  capturedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface StudentRefundDto {
  id: string;
  status: RefundStatus;
  amountMinor: number;
  currency: string;
  createdAt: string;
  processedAt: string | null;
}

/**
 * What the student should do next with an order:
 * PAY (open Checkout / try again), WAIT (a payment is being confirmed — check again shortly),
 * OPEN_COURSE (paid and enrolled), NONE (closed).
 */
export type OrderNextStep = 'PAY' | 'WAIT' | 'OPEN_COURSE' | 'NONE';

export interface StudentOrderDto {
  id: string;
  reference: string;
  status: OrderStatus;
  mode: PaymentMode;
  course: { id: string; slug: string; title: string };
  price: OrderPriceDto;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  failureReason: string | null;
  refundState: RefundState;
  refundedMinor: number;
  payments: StudentPaymentDto[];
  refunds: StudentRefundDto[];
  /** The student currently has an ACTIVE enrolment in the course. */
  enrollmentActive: boolean;
  receiptAvailable: boolean;
  nextStep: OrderNextStep;
}

/**
 * A payment receipt (acknowledgement of a verified payment). It is NOT a GST tax invoice: no
 * GSTIN, tax rate or address is printed until the academy provides them (M-04).
 */
export interface PaymentReceiptDto {
  receiptNumber: string;
  orderReference: string;
  providerPaymentId: string;
  mode: PaymentMode;
  issuer: { name: string };
  student: { fullName: string; email: string };
  course: { title: string };
  listPriceMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  method: string | null;
  paidAt: string;
  refundedMinor: number;
  refundState: RefundState;
  isTaxInvoice: false;
}

// --- Administration ---------------------------------------------------------------------------

export interface AdminPartyRef {
  userId: string;
  fullName: string;
  email: string;
}

export interface AdminOrderListItem {
  id: string;
  reference: string;
  status: OrderStatus;
  mode: PaymentMode;
  student: AdminPartyRef;
  course: { id: string; title: string };
  amountMinor: number;
  currency: string;
  refundedMinor: number;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminPaymentListItem {
  id: string;
  providerPaymentId: string;
  status: PaymentStatus;
  mode: PaymentMode;
  orderId: string;
  orderReference: string;
  student: AdminPartyRef;
  course: { id: string; title: string };
  amountMinor: number;
  currency: string;
  method: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  refundedMinor: number;
  /** Amount still refundable (captured − processed − in-flight refunds). */
  refundableMinor: number;
  /** This payment confirmed its order and activated the enrolment. */
  applied: boolean;
  reviewReason: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface AdminRefundDto {
  id: string;
  paymentId: string;
  providerPaymentId: string;
  providerRefundId: string | null;
  orderId: string;
  orderReference: string;
  student: AdminPartyRef;
  course: { id: string; title: string };
  mode: PaymentMode;
  status: RefundStatus;
  amountMinor: number;
  currency: string;
  reason: string | null;
  failureReason: string | null;
  /** Null when the refund was issued outside the platform (Razorpay Dashboard). */
  requestedBy: string | null;
  revokedAccess: boolean;
  createdAt: string;
  processedAt: string | null;
}

export interface PaymentAuditEntryDto {
  action: string;
  actor: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

export interface AdminOrderDetail extends AdminOrderListItem {
  providerOrderId: string | null;
  price: OrderPriceDto;
  expiresAt: string;
  cancelledAt: string | null;
  failureReason: string | null;
  lastReconciledAt: string | null;
  reconcileAttempts: number;
  confirmationEmailSentAt: string | null;
  enrollment: {
    id: string;
    status: 'ACTIVE' | 'CANCELLED';
    source: string;
    enrolledAt: string;
  } | null;
  payments: AdminPaymentListItem[];
  refunds: AdminRefundDto[];
  audit: PaymentAuditEntryDto[];
}

export interface CurrencyTotalsDto {
  currency: string;
  /** Σ captured payment amounts (each provider payment counted once). */
  grossCapturedMinor: number;
  /** Σ PROCESSED refunds of those payments. */
  refundedMinor: number;
  /** gross − refunded (before provider fees and taxes, which are not known to the platform). */
  netMinor: number;
  capturedPaymentCount: number;
}

/** `GET /admin/payments/summary` — always for ONE mode; test money is never mixed with live. */
export interface PaymentSummaryDto {
  mode: PaymentMode;
  from: string | null;
  to: string | null;
  totals: CurrencyTotalsDto[];
  paidOrderCount: number;
  pendingOrderCount: number;
  failedPaymentCount: number;
  needsReviewCount: number;
  openRefundCount: number;
}

/** `GET /admin/payments/config` — what is configured, never the values. */
export interface AdminPaymentsConfigDto {
  activeMode: PaymentMode | null;
  checkoutEnabled: boolean;
  modes: { mode: PaymentMode; configured: boolean; webhookConfigured: boolean }[];
  canRefund: boolean;
}
