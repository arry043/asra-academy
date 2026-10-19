import { prisma } from '../../database/prisma.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import type { Order } from '../../generated/prisma/client.js';
import { paymentAudit } from './audit.js';
import { paymentsConfig, type PaymentAccount } from './config.js';
import { applyProviderPayment, applyProviderRefund, expireOrder } from './core.js';
import { PaymentGatewayError, type ProviderPayment } from './gateway.js';
import { sendOrderConfirmationOnce, sendRefundNoticeOnce } from './notifications.js';

/**
 * Reconciliation (docs/PAYMENTS.md §10): reads the CURRENT state from Razorpay with the
 * credentials of the order's own mode and feeds it through the same `applyProviderPayment`.
 * Used by "check payment status", by order creation (before replacing an open order), by the
 * admin "Reconcile" action and by the background worker. Never activates anything from local
 * state alone.
 */

/**
 * Captures an AUTHORIZED payment that matches its order exactly (amount + currency + order id).
 * Razorpay auto-capture (recommended, Dashboard setting) normally makes this a no-op; this covers
 * accounts where it is off, since uncaptured payments are auto-refunded and must never grant
 * access. A capture that races another capture is resolved by re-reading the payment.
 */
export async function captureIfAuthorized(
  account: PaymentAccount,
  order: Pick<Order, 'id' | 'amountMinor' | 'currency' | 'providerOrderId'>,
  payment: ProviderPayment,
): Promise<ProviderPayment> {
  if (payment.status !== 'authorized' || payment.captured) return payment;
  if (
    payment.orderId !== order.providerOrderId ||
    payment.amountMinor !== order.amountMinor ||
    payment.currency !== order.currency
  ) {
    return payment; // recorded as-is (not captured, never applied)
  }
  try {
    const captured = await account.gateway.capturePayment(
      payment.id,
      payment.amountMinor,
      payment.currency,
    );
    await paymentAudit(prisma, {
      action: 'payment.captured_by_platform',
      entityType: 'order',
      entityId: order.id,
      data: { providerPaymentId: payment.id },
    });
    return captured;
  } catch (error) {
    if (error instanceof PaymentGatewayError && error.kind === 'REJECTED') {
      // Typically "already captured" (auto-capture or a concurrent capture won): re-read.
      return account.gateway.fetchPayment(payment.id);
    }
    throw error;
  }
}

/** Applies one provider payment and sends the confirmation if this call paid the order. */
export async function applyAndNotify(
  orderId: string,
  payment: ProviderPayment,
  options: Parameters<typeof applyProviderPayment>[2],
) {
  const result = await applyProviderPayment(orderId, payment, options);
  if (result.orderStatus === 'PAID') await sendOrderConfirmationOnce(orderId);
  return result;
}

/**
 * Brings one order in line with Razorpay. Returns the order's status afterwards. Provider errors
 * propagate (callers decide whether that is a 503 or a later retry); the attempt is counted.
 */
export async function reconcileOrder(
  orderId: string,
  options: { actorId?: string | null } = {},
): Promise<Order['status']> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const now = clock.now();

  if (!order.providerOrderId) {
    // The provider order was never created: nothing can have been paid.
    if (order.status === 'CREATED' && order.expiresAt <= now) await expireOrder(order.id);
    return (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
  }

  const account = paymentsConfig.requireAccount(order.mode);
  await prisma.order.update({
    where: { id: orderId },
    data: { lastReconciledAt: now, reconcileAttempts: { increment: 1 } },
  });

  const payments = await account.gateway.fetchOrderPayments(order.providerOrderId);
  for (const listed of payments) {
    if (listed.orderId !== order.providerOrderId) continue;
    const payment = await captureIfAuthorized(account, order, listed);
    await applyAndNotify(order.id, payment, { source: 'fetch', actorId: options.actorId });
    if (payment.captured && payment.amountRefundedMinor > 0) {
      await syncPaymentRefunds(order.id, payment.id, account);
    }
  }

  const current = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (['CREATED', 'PENDING'].includes(current.status) && current.expiresAt <= clock.now()) {
    await expireOrder(current.id);
  }
  if (options.actorId) {
    await paymentAudit(prisma, {
      action: 'order.reconciled',
      actorId: options.actorId,
      entityType: 'order',
      entityId: orderId,
      data: { providerPayments: payments.length },
    });
  }
  return (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
}

/** Re-reads every refund of one captured payment from Razorpay and records it. */
export async function syncPaymentRefunds(
  orderId: string,
  providerPaymentId: string,
  account?: PaymentAccount,
): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { orderId, providerPaymentId },
    select: { id: true, mode: true },
  });
  if (!payment) return;
  const gateway = (account ?? paymentsConfig.requireAccount(payment.mode)).gateway;
  for (const refund of await gateway.fetchPaymentRefunds(providerPaymentId)) {
    const result = await applyProviderRefund(payment.id, refund);
    if (result.justProcessed) await sendRefundNoticeOnce(result.refundId);
  }
}

/** Swallows provider/database errors for background callers, logging only safe metadata. */
export async function reconcileQuietly(orderId: string): Promise<void> {
  try {
    await reconcileOrder(orderId);
  } catch (error) {
    const { name, kind, code } = error as { name?: string; kind?: string; code?: string };
    logger.warn({ orderId, errorName: name, kind, code }, 'Order reconciliation failed');
  }
}
