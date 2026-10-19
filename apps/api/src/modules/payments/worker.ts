import { PAYMENT_RECONCILE_SWEEP_MS } from '../../config/constants.js';
import { prisma } from '../../database/prisma.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import { paymentsConfig } from './config.js';
import { MAX_CONFIRMATION_EMAIL_ATTEMPTS, sendOrderConfirmationOnce } from './notifications.js';
import { reconcileQuietly } from './reconcile.js';
import { refundsService } from './refunds.service.js';

/**
 * Background recovery (docs/PAYMENTS.md §10). Started by the long-running server only.
 *
 * A convenience, not the correctness mechanism: webhooks, Checkout verification and the
 * student's "check status" each settle an order on their own. This sweep catches what all of
 * them missed (lost callback AND lost webhook), with bounded work:
 *   - open orders with a provider order, older than 2 minutes, at most MAX_ATTEMPTS checks each,
 *     spaced by attempts² minutes (2, 4, 9, 16 … min), BATCH per tick;
 *   - REQUESTED/PENDING refunds (re-read by receipt; resubmitted only when provably absent);
 *   - unsent payment confirmations (bounded attempts).
 * It keeps no state in memory: everything is in PostgreSQL, so restarts resume exactly. Several
 * instances may run it — every step is idempotent and row-locked. Serverless deployments (Vercel)
 * do not run it; there, recovery relies on webhooks and on-demand checks.
 */

const BATCH = 20;
const MAX_ATTEMPTS = 12;
const MIN_AGE_MS = 2 * 60_000;

export async function sweepPayments(): Promise<void> {
  const now = clock.now();
  const configuredModes = paymentsConfig
    .describe()
    .filter((m) => m.configured)
    .map((m) => m.mode);
  if (configuredModes.length === 0) return;

  const candidates = await prisma.order.findMany({
    where: {
      mode: { in: configuredModes },
      status: { in: ['CREATED', 'PENDING'] },
      createdAt: { lt: new Date(now.getTime() - MIN_AGE_MS) },
      reconcileAttempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { lastReconciledAt: { sort: 'asc', nulls: 'first' } },
    take: BATCH * 3,
    select: { id: true, lastReconciledAt: true, reconcileAttempts: true },
  });
  const due = candidates
    .filter((order) => {
      if (!order.lastReconciledAt) return true;
      const backoffMs = Math.max(1, order.reconcileAttempts) ** 2 * 60_000;
      return now.getTime() - order.lastReconciledAt.getTime() >= backoffMs;
    })
    .slice(0, BATCH);
  for (const order of due) await reconcileQuietly(order.id);

  const refunds = await prisma.refund.findMany({
    where: { mode: { in: configuredModes }, status: { in: ['REQUESTED', 'PENDING'] } },
    orderBy: { updatedAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  for (const refund of refunds) {
    await refundsService.reconcile(refund.id).catch((error: unknown) => {
      logger.warn(
        { refundId: refund.id, errorName: (error as Error).name },
        'Refund reconciliation failed',
      );
    });
  }

  const unsent = await prisma.order.findMany({
    where: {
      status: 'PAID',
      confirmationEmailSentAt: null,
      confirmationEmailAttempts: { lt: MAX_CONFIRMATION_EMAIL_ATTEMPTS },
    },
    take: BATCH,
    select: { id: true },
  });
  for (const order of unsent) await sendOrderConfirmationOnce(order.id);
}

export function startPaymentReconciliationWorker(
  intervalMs = PAYMENT_RECONCILE_SWEEP_MS,
): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sweepPayments();
    } catch (error) {
      const { name, code } = error as { name?: string; code?: string };
      logger.warn({ errorName: name, errorCode: code }, 'Payment reconciliation sweep failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
