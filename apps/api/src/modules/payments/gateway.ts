import type { PaymentMode } from '../../generated/prisma/client.js';

/**
 * Provider boundary (docs/PAYMENTS.md §3). Business code depends on this interface only; the
 * Razorpay REST implementation lives in razorpay.gateway.ts. Automated tests inject an in-memory
 * gateway (tests/support/razorpay-fake.ts) — no test can reach Razorpay.
 *
 * Every value returned here was read from the provider over an authenticated server-to-server
 * call, so it is authoritative (unlike anything the browser reports).
 */

/** Razorpay payment states (https://razorpay.com/docs/payments/payments/#payment-life-cycle). */
export type ProviderPaymentStatus = 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface ProviderPayment {
  id: string;
  orderId: string | null;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: string;
  /** True once captured (stays true when the payment is later refunded). */
  captured: boolean;
  method: string | null;
  amountRefundedMinor: number;
  errorCode: string | null;
  errorDescription: string | null;
}

export interface ProviderOrder {
  id: string;
  amountMinor: number;
  currency: string;
  receipt: string | null;
  status: 'created' | 'attempted' | 'paid';
}

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  receipt: string | null;
}

/**
 * - TIMEOUT / NETWORK / UNAVAILABLE (5xx): transient — the outcome is UNKNOWN; retry or reconcile.
 * - REJECTED (4xx): the provider refused the request; it did not happen.
 * - AUTH (401): wrong credentials for this mode — a configuration error.
 */
export type GatewayErrorKind = 'TIMEOUT' | 'NETWORK' | 'UNAVAILABLE' | 'REJECTED' | 'AUTH';

export class PaymentGatewayError extends Error {
  constructor(
    readonly kind: GatewayErrorKind,
    message: string,
    /** Provider error code/description — safe to log; never contains secrets. */
    readonly providerCode?: string,
    readonly providerDescription?: string,
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }

  /** The request may or may not have taken effect at the provider. */
  get outcomeUnknown(): boolean {
    return this.kind === 'TIMEOUT' || this.kind === 'NETWORK' || this.kind === 'UNAVAILABLE';
  }
}

export interface CreateProviderOrderInput {
  amountMinor: number;
  currency: string;
  /** Our order reference (≤ 40 chars). */
  receipt: string;
  notes: Record<string, string>;
}

export interface CreateProviderRefundInput {
  amountMinor: number;
  /** Our idempotency key: Razorpay refuses a second refund with the same receipt on a payment. */
  receipt: string;
  notes: Record<string, string>;
}

export interface PaymentGateway {
  readonly mode: PaymentMode;
  readonly keyId: string;
  createOrder(input: CreateProviderOrderInput): Promise<ProviderOrder>;
  fetchOrder(providerOrderId: string): Promise<ProviderOrder>;
  fetchOrderPayments(providerOrderId: string): Promise<ProviderPayment[]>;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
  capturePayment(
    providerPaymentId: string,
    amountMinor: number,
    currency: string,
  ): Promise<ProviderPayment>;
  createRefund(
    providerPaymentId: string,
    input: CreateProviderRefundInput,
  ): Promise<ProviderRefund>;
  fetchPaymentRefunds(providerPaymentId: string): Promise<ProviderRefund[]>;
}
