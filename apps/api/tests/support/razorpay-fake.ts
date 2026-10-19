import { randomBytes } from 'node:crypto';
import type { PaymentMode } from '../../src/generated/prisma/client.js';
import {
  PaymentGatewayError,
  type GatewayErrorKind,
  type PaymentGateway,
  type ProviderOrder,
  type ProviderPayment,
  type ProviderRefund,
} from '../../src/modules/payments/gateway.js';
import { hmacSha256Hex } from '../../src/modules/payments/signatures.js';

/**
 * In-memory stand-in for the Razorpay API, used ONLY by automated tests (it lives under tests/,
 * never in src/). It reproduces the behaviour the platform depends on — order/payment/refund
 * lifecycles, capture of authorised payments, duplicate-receipt refusal, Checkout signatures and
 * webhook signatures — so no test ever needs network access, credentials or real money.
 */

type Method = keyof Omit<PaymentGateway, 'mode' | 'keyId'>;

const alnum = (n: number) =>
  [...randomBytes(n)]
    .map((b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62])
    .join('');

export class FakeRazorpay implements PaymentGateway {
  readonly orders = new Map<string, ProviderOrder>();
  readonly payments = new Map<string, ProviderPayment>();
  readonly refunds = new Map<string, ProviderRefund>();
  readonly calls: Method[] = [];
  private failures: { method: Method; kind: GatewayErrorKind; description?: string }[] = [];
  /** Status a newly created refund starts in. */
  refundInitialStatus: ProviderRefund['status'] = 'pending';

  constructor(
    readonly mode: PaymentMode,
    readonly keyId: string,
    readonly keySecret: string,
    readonly webhookSecret: string,
  ) {}

  /** The next call of `method` throws a gateway error of `kind`. */
  failNext(method: Method, kind: GatewayErrorKind, description?: string): void {
    this.failures.push({ method, kind, ...(description ? { description } : {}) });
  }

  private enter(method: Method): void {
    this.calls.push(method);
    const index = this.failures.findIndex((failure) => failure.method === method);
    if (index >= 0) {
      const [failure] = this.failures.splice(index, 1);
      throw new PaymentGatewayError(
        failure!.kind,
        `fake ${method} failed`,
        'FAKE_ERROR',
        failure!.description,
      );
    }
  }

  count(method: Method): number {
    return this.calls.filter((call) => call === method).length;
  }

  // --- Test controls (what the student / bank does) ------------------------------------------

  /** A payment attempt on `providerOrderId`, plus the Checkout signature Razorpay would return. */
  pay(
    providerOrderId: string,
    options: {
      status?: 'captured' | 'authorized' | 'failed' | 'created';
      amountMinor?: number;
      currency?: string;
      errorDescription?: string;
    } = {},
  ): { payment: ProviderPayment; signature: string } {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error(`fake: unknown order ${providerOrderId}`);
    const status = options.status ?? 'captured';
    const payment: ProviderPayment = {
      id: `pay_${alnum(14)}`,
      orderId: providerOrderId,
      status,
      amountMinor: options.amountMinor ?? order.amountMinor,
      currency: options.currency ?? order.currency,
      captured: status === 'captured',
      method: 'upi',
      amountRefundedMinor: 0,
      errorCode: status === 'failed' ? 'BAD_REQUEST_ERROR' : null,
      errorDescription:
        status === 'failed'
          ? (options.errorDescription ?? 'Payment was declined by the bank.')
          : null,
    };
    this.payments.set(payment.id, payment);
    if (status === 'captured') order.status = 'paid';
    else if (order.status === 'created') order.status = 'attempted';
    return {
      payment: { ...payment },
      signature: this.checkoutSignature(providerOrderId, payment.id),
    };
  }

  /** Moves an existing payment (e.g. a UPI retry captured after a failure). */
  setPaymentStatus(paymentId: string, status: ProviderPayment['status']): ProviderPayment {
    const payment = this.payments.get(paymentId)!;
    payment.status = status;
    payment.captured = payment.captured || status === 'captured';
    if (status === 'captured') this.orders.get(payment.orderId!)!.status = 'paid';
    return { ...payment };
  }

  processRefund(refundId: string, status: 'processed' | 'failed' = 'processed'): ProviderRefund {
    const refund = this.refunds.get(refundId)!;
    refund.status = status;
    if (status === 'processed') {
      const payment = this.payments.get(refund.paymentId)!;
      payment.amountRefundedMinor += refund.amountMinor;
    }
    return { ...refund };
  }

  checkoutSignature(providerOrderId: string, paymentId: string, secret = this.keySecret): string {
    return hmacSha256Hex(secret, `${providerOrderId}|${paymentId}`);
  }

  /** A webhook body in Razorpay's envelope, as raw JSON text, with its signature. */
  webhook(
    event: string,
    entities: { payment?: ProviderPayment; refund?: ProviderRefund },
    secret = this.webhookSecret,
  ): { body: string; signature: string } {
    const payload: Record<string, unknown> = {};
    if (entities.payment) payload.payment = { entity: toRazorpayPayment(entities.payment) };
    if (entities.refund) payload.refund = { entity: toRazorpayRefund(entities.refund) };
    const body = JSON.stringify({
      entity: 'event',
      account_id: 'acc_FAKE',
      event,
      contains: Object.keys(payload),
      payload,
      created_at: Math.floor(Date.now() / 1000),
    });
    return { body, signature: hmacSha256Hex(secret, body) };
  }

  // --- PaymentGateway -------------------------------------------------------------------------

  async createOrder(input: { amountMinor: number; currency: string; receipt: string }) {
    this.enter('createOrder');
    const order: ProviderOrder = {
      id: `order_${alnum(14)}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      status: 'created',
    };
    this.orders.set(order.id, order);
    return { ...order };
  }

  async fetchOrder(providerOrderId: string) {
    this.enter('fetchOrder');
    const order = this.orders.get(providerOrderId);
    if (!order) throw new PaymentGatewayError('REJECTED', 'not found');
    return { ...order };
  }

  async fetchOrderPayments(providerOrderId: string) {
    this.enter('fetchOrderPayments');
    return [...this.payments.values()]
      .filter((p) => p.orderId === providerOrderId)
      .map((p) => ({ ...p }));
  }

  async fetchPayment(paymentId: string) {
    this.enter('fetchPayment');
    const payment = this.payments.get(paymentId);
    if (!payment) throw new PaymentGatewayError('REJECTED', 'not found', 'BAD_REQUEST_ERROR');
    return { ...payment };
  }

  async capturePayment(paymentId: string, amountMinor: number, currency: string) {
    this.enter('capturePayment');
    const payment = this.payments.get(paymentId);
    if (
      !payment ||
      payment.status !== 'authorized' ||
      amountMinor !== payment.amountMinor ||
      currency !== payment.currency
    ) {
      throw new PaymentGatewayError('REJECTED', 'cannot capture', 'BAD_REQUEST_ERROR');
    }
    return this.setPaymentStatus(paymentId, 'captured');
  }

  async createRefund(paymentId: string, input: { amountMinor: number; receipt: string }) {
    this.enter('createRefund');
    const payment = this.payments.get(paymentId);
    if (!payment || !payment.captured) throw new PaymentGatewayError('REJECTED', 'not refundable');
    const existing = [...this.refunds.values()].filter((r) => r.paymentId === paymentId);
    if (existing.some((r) => r.receipt === input.receipt)) {
      throw new PaymentGatewayError(
        'REJECTED',
        'duplicate receipt',
        'BAD_REQUEST_ERROR',
        'Duplicate receipt',
      );
    }
    const used = existing
      .filter((r) => r.status !== 'failed')
      .reduce((sum, r) => sum + r.amountMinor, 0);
    if (used + input.amountMinor > payment.amountMinor) {
      throw new PaymentGatewayError(
        'REJECTED',
        'exceeds',
        'BAD_REQUEST_ERROR',
        'The refund amount exceeds the payment',
      );
    }
    const refund: ProviderRefund = {
      id: `rfnd_${alnum(14)}`,
      paymentId,
      amountMinor: input.amountMinor,
      currency: payment.currency,
      status: 'pending',
      receipt: input.receipt,
    };
    this.refunds.set(refund.id, refund);
    if (this.refundInitialStatus === 'processed') return this.processRefund(refund.id);
    return { ...refund };
  }

  async fetchPaymentRefunds(paymentId: string) {
    this.enter('fetchPaymentRefunds');
    return [...this.refunds.values()]
      .filter((r) => r.paymentId === paymentId)
      .map((r) => ({ ...r }));
  }
}

function toRazorpayPayment(p: ProviderPayment) {
  return {
    id: p.id,
    entity: 'payment',
    amount: p.amountMinor,
    currency: p.currency,
    status: p.status,
    order_id: p.orderId,
    method: p.method,
    captured: p.captured,
    amount_refunded: p.amountRefundedMinor,
    error_code: p.errorCode,
    error_description: p.errorDescription,
    // Fields that must never be stored by the platform:
    email: 'student@example.test',
    contact: '+919999999999',
    vpa: 'student@upi',
  };
}

function toRazorpayRefund(r: ProviderRefund) {
  return {
    id: r.id,
    entity: 'refund',
    amount: r.amountMinor,
    currency: r.currency,
    payment_id: r.paymentId,
    receipt: r.receipt,
    status: r.status,
  };
}
