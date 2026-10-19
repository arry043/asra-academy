import { z } from 'zod';
import type { PaymentMode } from '../../generated/prisma/client.js';
import {
  PaymentGatewayError,
  type CreateProviderOrderInput,
  type CreateProviderRefundInput,
  type PaymentGateway,
  type ProviderOrder,
  type ProviderPayment,
  type ProviderRefund,
} from './gateway.js';

/**
 * Razorpay over its documented REST API (https://razorpay.com/docs/api/), authenticated with HTTP
 * Basic `key_id:key_secret`. The official SDK is a thin wrapper over the same endpoints; calling
 * them directly keeps the dependency surface (and Vercel's CJS type-check quirks) out of the API,
 * gives every call an explicit timeout, and validates every response before it is trusted.
 *
 * Test and live mode use the same host — the KEY decides the environment (`rzp_test_…` /
 * `rzp_live_…`, enforced in config/env.ts). The secret is only ever placed in the Authorization
 * header and is never logged or included in an error.
 */

const API_BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 10_000;

const paymentSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable().optional(),
  status: z.enum(['created', 'authorized', 'captured', 'refunded', 'failed']),
  amount: z.number().int(),
  currency: z.string(),
  captured: z.boolean().optional(),
  method: z.string().nullable().optional(),
  amount_refunded: z.number().int().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
});

const orderSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  receipt: z.string().nullable().optional(),
  status: z.enum(['created', 'attempted', 'paid']),
});

const refundSchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(['pending', 'processed', 'failed']),
  receipt: z.string().nullable().optional(),
});

const collection = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

const errorBodySchema = z.object({
  error: z.object({ code: z.string().optional(), description: z.string().optional() }).optional(),
});

export function toProviderPayment(raw: z.infer<typeof paymentSchema>): ProviderPayment {
  return {
    id: raw.id,
    orderId: raw.order_id ?? null,
    status: raw.status,
    amountMinor: raw.amount,
    currency: raw.currency,
    captured: raw.captured ?? raw.status === 'captured',
    method: raw.method ?? null,
    amountRefundedMinor: raw.amount_refunded ?? 0,
    errorCode: raw.error_code ?? null,
    errorDescription: raw.error_description ?? null,
  };
}

const toProviderOrder = (raw: z.infer<typeof orderSchema>): ProviderOrder => ({
  id: raw.id,
  amountMinor: raw.amount,
  currency: raw.currency,
  receipt: raw.receipt ?? null,
  status: raw.status,
});

export const toProviderRefund = (raw: z.infer<typeof refundSchema>): ProviderRefund => ({
  id: raw.id,
  paymentId: raw.payment_id,
  amountMinor: raw.amount,
  currency: raw.currency,
  status: raw.status,
  receipt: raw.receipt ?? null,
});

/** Schemas reused to read webhook payload entities (same shapes as the REST API). */
export const razorpayEntitySchemas = { payment: paymentSchema, refund: refundSchema };

export function createRazorpayGateway(options: {
  mode: PaymentMode;
  keyId: string;
  keySecret: string;
  fetchImpl?: typeof fetch;
}): PaymentGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authorization = `Basic ${Buffer.from(`${options.keyId}:${options.keySecret}`).toString('base64')}`;

  async function call<T extends z.ZodType>(
    method: 'GET' | 'POST',
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = (error as { name?: string }).name === 'TimeoutError';
      throw new PaymentGatewayError(
        timedOut ? 'TIMEOUT' : 'NETWORK',
        timedOut ? 'Razorpay did not respond in time' : 'Razorpay could not be reached',
      );
    }

    const text = await response.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // handled below
    }

    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json);
      const code = parsed.success ? parsed.data.error?.code : undefined;
      const description = parsed.success ? parsed.data.error?.description : undefined;
      const kind =
        response.status === 401 ? 'AUTH' : response.status >= 500 ? 'UNAVAILABLE' : 'REJECTED';
      throw new PaymentGatewayError(
        response.status === 429 ? 'UNAVAILABLE' : kind,
        `Razorpay ${method} ${path.split('/')[1]} failed (${response.status})`,
        code,
        description,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new PaymentGatewayError('UNAVAILABLE', 'Unexpected response from Razorpay');
    }
    return parsed.data;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    mode: options.mode,
    keyId: options.keyId,

    async createOrder(input: CreateProviderOrderInput) {
      return toProviderOrder(
        await call('POST', '/orders', orderSchema, {
          amount: input.amountMinor,
          currency: input.currency,
          receipt: input.receipt,
          notes: input.notes,
        }),
      );
    },

    async fetchOrder(providerOrderId) {
      return toProviderOrder(await call('GET', `/orders/${id(providerOrderId)}`, orderSchema));
    },

    async fetchOrderPayments(providerOrderId) {
      const result = await call(
        'GET',
        `/orders/${id(providerOrderId)}/payments`,
        collection(paymentSchema),
      );
      return result.items.map(toProviderPayment);
    },

    async fetchPayment(providerPaymentId) {
      return toProviderPayment(
        await call('GET', `/payments/${id(providerPaymentId)}`, paymentSchema),
      );
    },

    async capturePayment(providerPaymentId, amountMinor, currency) {
      return toProviderPayment(
        await call('POST', `/payments/${id(providerPaymentId)}/capture`, paymentSchema, {
          amount: amountMinor,
          currency,
        }),
      );
    },

    async createRefund(providerPaymentId, input: CreateProviderRefundInput) {
      return toProviderRefund(
        await call('POST', `/payments/${id(providerPaymentId)}/refund`, refundSchema, {
          amount: input.amountMinor,
          speed: 'normal',
          receipt: input.receipt,
          notes: input.notes,
        }),
      );
    },

    async fetchPaymentRefunds(providerPaymentId): Promise<ProviderRefund[]> {
      const result = await call(
        'GET',
        `/payments/${id(providerPaymentId)}/refunds?count=100`,
        collection(refundSchema),
      );
      return result.items.map(toProviderRefund);
    },
  };
}
