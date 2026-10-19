import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import type { PaymentMode, Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import { sendError, sendSuccess } from '../../utils/api-response.js';
import { paymentAudit } from './audit.js';
import { paymentsConfig, type PaymentAccount } from './config.js';
import { applyProviderRefund } from './core.js';
import { razorpayEntitySchemas, toProviderPayment, toProviderRefund } from './razorpay.gateway.js';
import { applyAndNotify, captureIfAuthorized } from './reconcile.js';
import { sendRefundNoticeOnce } from './notifications.js';

/**
 * `POST /api/v1/payments/webhooks/razorpay/:mode` (docs/PAYMENTS.md §7).
 *
 * 1. The body arrives as RAW BYTES (express.raw, mounted before express.json in app.ts) and the
 *    HMAC is computed over exactly those bytes with the webhook secret of the URL's mode.
 *    Nothing is parsed, stored or changed before the signature is verified.
 * 2. Deduplicated durably by `x-razorpay-event-id` (UNIQUE provider+mode+event id). A delivery of
 *    an event that is already PROCESSED/IGNORED is acknowledged (200) without side effects.
 * 3. Processing is claimed with a lease (PROCESSING) so concurrent duplicate deliveries never run
 *    side effects twice; the event is marked PROCESSED only after its changes committed. Every
 *    side effect is itself idempotent, so a crash between the two is safe to replay.
 * 4. Non-2xx tells Razorpay to retry: invalid signature 400, not configured 503, in progress 409,
 *    internal failure 500 (event left FAILED and retried on redelivery).
 */

const PROCESSING_LEASE_MS = 2 * 60_000;

const eventSchema = z.object({
  event: z.string().min(1).max(60),
  payload: z
    .object({
      payment: z.object({ entity: z.unknown() }).optional(),
      refund: z.object({ entity: z.unknown() }).optional(),
    })
    .passthrough(),
});

type Outcome = { status: 'PROCESSED' | 'IGNORED'; note?: string };

function modeFromRequest(req: Request): PaymentMode | null {
  const param = req.params.mode;
  if (param === undefined) return paymentsConfig.activeMode();
  return param === 'test' ? 'TEST' : param === 'live' ? 'LIVE' : null;
}

/** Ids and amounts only — no email, contact, card, VPA or bank data is ever stored. */
function extract(event: z.infer<typeof eventSchema>): Prisma.InputJsonObject {
  const payment = razorpayEntitySchemas.payment.safeParse(event.payload.payment?.entity);
  const refund = razorpayEntitySchemas.refund.safeParse(event.payload.refund?.entity);
  return {
    ...(payment.success
      ? {
          payment: {
            id: payment.data.id,
            order_id: payment.data.order_id ?? null,
            status: payment.data.status,
            amount: payment.data.amount,
            currency: payment.data.currency,
            captured: payment.data.captured ?? null,
            method: payment.data.method ?? null,
            amount_refunded: payment.data.amount_refunded ?? null,
            error_code: payment.data.error_code ?? null,
            error_description: payment.data.error_description ?? null,
          },
        }
      : {}),
    ...(refund.success
      ? {
          refund: {
            id: refund.data.id,
            payment_id: refund.data.payment_id,
            status: refund.data.status,
            amount: refund.data.amount,
            currency: refund.data.currency,
            receipt: refund.data.receipt ?? null,
          },
        }
      : {}),
  };
}

async function processPaymentEvent(
  mode: PaymentMode,
  account: PaymentAccount,
  data: Prisma.JsonObject,
): Promise<Outcome> {
  const parsed = razorpayEntitySchemas.payment.safeParse(data.payment);
  if (!parsed.success) return { status: 'IGNORED', note: 'No payment entity in payload' };
  const payment = toProviderPayment(parsed.data);
  if (!payment.orderId) return { status: 'IGNORED', note: 'Payment without an order' };
  const order = await prisma.order.findUnique({ where: { providerOrderId: payment.orderId } });
  // Other integrations may share the Razorpay account: an order we never created is not ours.
  if (!order) return { status: 'IGNORED', note: 'Unknown order' };
  if (order.mode !== mode) {
    await paymentAudit(prisma, {
      action: 'webhook.mode_mismatch',
      entityType: 'order',
      entityId: order.id,
      data: { webhookMode: mode, orderMode: order.mode },
    });
    return { status: 'IGNORED', note: 'Order belongs to the other payment mode' };
  }
  const settled = await captureIfAuthorized(account, order, payment);
  await applyAndNotify(order.id, settled, { source: settled === payment ? 'webhook' : 'fetch' });
  return { status: 'PROCESSED' };
}

async function processRefundEvent(mode: PaymentMode, data: Prisma.JsonObject): Promise<Outcome> {
  const parsed = razorpayEntitySchemas.refund.safeParse(data.refund);
  if (!parsed.success) return { status: 'IGNORED', note: 'No refund entity in payload' };
  const refund = toProviderRefund(parsed.data);
  const payment = await prisma.payment.findUnique({
    where: {
      provider_providerPaymentId: { provider: 'RAZORPAY', providerPaymentId: refund.paymentId },
    },
    select: { id: true, mode: true },
  });
  if (!payment) return { status: 'IGNORED', note: 'Unknown payment' };
  if (payment.mode !== mode)
    return { status: 'IGNORED', note: 'Payment belongs to the other payment mode' };
  const result = await applyProviderRefund(payment.id, refund);
  if (result.justProcessed) await sendRefundNoticeOnce(result.refundId);
  return { status: 'PROCESSED' };
}

const PAYMENT_EVENTS = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'order.paid',
]);
const REFUND_EVENTS = new Set(['refund.created', 'refund.processed', 'refund.failed']);

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const mode = modeFromRequest(req);
  if (!mode) {
    sendError(res, 404, 'NOT_FOUND', 'Unknown webhook');
    return;
  }
  const account = paymentsConfig.account(mode);
  if (!account?.webhook) {
    // Not configured on this deployment: let Razorpay retry rather than lose the event.
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Webhooks are not configured');
    return;
  }
  const raw = req.body;
  const signature = req.get('x-razorpay-signature');
  if (!Buffer.isBuffer(raw) || raw.length === 0 || !signature) {
    sendError(res, 400, 'BAD_REQUEST', 'Missing body or signature');
    return;
  }
  if (!account.webhook.verify(raw, signature)) {
    logger.warn({ mode }, 'Rejected webhook with an invalid signature');
    sendError(res, 400, 'BAD_REQUEST', 'Invalid signature');
    return;
  }

  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(JSON.parse(raw.toString('utf8')));
  } catch {
    sendError(res, 400, 'BAD_REQUEST', 'Malformed event');
    return;
  }
  const payloadHash = createHash('sha256').update(raw).digest('hex');
  const headerId = req.get('x-razorpay-event-id')?.trim();
  const eventId = (headerId && headerId.length <= 100 ? headerId : `sha256:${payloadHash}`).slice(
    0,
    100,
  );

  // Record (or find) the event.
  // ON CONFLICT DO NOTHING: a duplicate delivery finds the first delivery's row.
  await prisma.paymentWebhookEvent.createMany({
    data: [{ mode, eventId, eventType: event.event, payloadHash, data: extract(event) }],
    skipDuplicates: true,
  });
  const row = await prisma.paymentWebhookEvent.findUniqueOrThrow({
    where: { provider_mode_eventId: { provider: 'RAZORPAY', mode, eventId } },
  });
  if (row.status === 'PROCESSED' || row.status === 'IGNORED') {
    sendSuccess(res, { received: true, duplicate: true }, 'Already processed');
    return;
  }

  // Claim it (one processor at a time; a stale lease is reclaimed).
  const now = clock.now();
  const claim = await prisma.paymentWebhookEvent.updateMany({
    where: {
      id: row.id,
      OR: [
        { status: { in: ['RECEIVED', 'FAILED'] } },
        { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - PROCESSING_LEASE_MS) } },
      ],
    },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });
  if (claim.count === 0) {
    sendError(res, 409, 'CONFLICT', 'Event is being processed');
    return;
  }

  try {
    const data = row.data as Prisma.JsonObject;
    const outcome: Outcome = PAYMENT_EVENTS.has(event.event)
      ? await processPaymentEvent(mode, account, data)
      : REFUND_EVENTS.has(event.event)
        ? await processRefundEvent(mode, data)
        : { status: 'IGNORED', note: 'Event type not used by the platform' };
    await prisma.paymentWebhookEvent.update({
      where: { id: row.id },
      data: { status: outcome.status, note: outcome.note ?? null, processedAt: clock.now() },
    });
    sendSuccess(res, { received: true }, 'Processed');
  } catch (error) {
    const { name, code, kind } = error as { name?: string; code?: string; kind?: string };
    logger.error(
      { eventId, eventType: event.event, errorName: name, code, kind },
      'Webhook processing failed',
    );
    await prisma.paymentWebhookEvent
      .update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          note: [name, code ?? kind].filter(Boolean).join(': ').slice(0, 500),
        },
      })
      .catch(() => undefined);
    sendError(res, 500, 'INTERNAL_ERROR', 'Event could not be processed');
  }
}
