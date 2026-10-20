import {
  NOTIFICATION_EMAIL_CLAIM_LEASE_MS,
  NOTIFICATION_EMAIL_MAX_ATTEMPTS,
  NOTIFICATION_EMAIL_SWEEP_MS,
} from '../../config/constants.js';
import { prisma } from '../../database/prisma.js';
import { emailService } from '../../email/email.service.js';
import { isPermanentResendError, ResendDeliveryError } from '../../email/transports.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import { buildNotificationEmail, EmailNotApplicable } from './email-content.js';

/**
 * Email outbox delivery (PHASE 11, docs/NOTIFICATIONS.md §6).
 *
 * Exactly-once (best effort), the same pattern as payment confirmations:
 *   1. CLAIM: a conditional UPDATE moves one delivery PENDING → SENDING; only one process wins.
 *      A SENDING row older than the lease was abandoned by a crashed process and can be reclaimed.
 *   2. SEND through emailService with a Resend idempotency key derived from the delivery id, so
 *      even a reclaimed or timed-out send is not delivered twice (Resend keeps keys for 24 h).
 *   3. RECORD: ACCEPTED (+ provider message id) — acceptance by Resend, not inbox delivery;
 *      or PENDING again with backoff (attempts² minutes); or FAILED when the error is permanent
 *      or NOTIFICATION_EMAIL_MAX_ATTEMPTS is reached; or SKIPPED when no longer applicable.
 *
 * Retrying a delivery only re-sends an email: it never repeats the business operation. Errors
 * are recorded as error classes/codes only — never addresses, bodies or keys.
 */

export type DeliveryOutcome = 'ACCEPTED' | 'RETRY' | 'FAILED' | 'SKIPPED' | 'NOT_CLAIMED';

/** Short, non-sensitive description of a send failure. */
function describeFailure(error: unknown): string {
  const cause = (error as { cause?: unknown }).cause ?? error;
  if (cause instanceof ResendDeliveryError) {
    return `Resend rejected the message (${cause.code}, status ${cause.statusCode ?? 'none'})`;
  }
  if (cause instanceof Error && /timed out/.test(cause.message))
    return 'Provider request timed out';
  return `Send failed (${(cause as { name?: string }).name ?? 'Error'})`;
}

export async function deliverEmail(deliveryId: string): Promise<DeliveryOutcome> {
  const now = clock.now();
  const claimed = await prisma.notificationDelivery.updateMany({
    where: {
      id: deliveryId,
      channel: 'EMAIL',
      attempts: { lt: NOTIFICATION_EMAIL_MAX_ATTEMPTS },
      OR: [
        { status: 'PENDING', nextAttemptAt: { lte: now } },
        {
          status: 'SENDING',
          claimedAt: { lt: new Date(now.getTime() - NOTIFICATION_EMAIL_CLAIM_LEASE_MS) },
        },
      ],
    },
    data: { status: 'SENDING', claimedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return 'NOT_CLAIMED';

  const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    select: {
      attempts: true,
      notification: {
        select: {
          id: true,
          event: true,
          title: true,
          message: true,
          actionUrl: true,
          resourceId: true,
          data: true,
          user: { select: { email: true, fullName: true, status: true } },
        },
      },
    },
  });
  // Only the process holding THIS claim may record the outcome.
  const mine = { id: deliveryId, status: 'SENDING' as const, claimedAt: now };
  const finish = (data: {
    status: 'ACCEPTED' | 'PENDING' | 'FAILED' | 'SKIPPED';
    lastError?: string | null;
    providerMessageId?: string | null;
    nextAttemptAt?: Date;
  }) =>
    prisma.notificationDelivery.updateMany({
      where: mine,
      data: {
        ...data,
        claimedAt: null,
        ...(data.status === 'ACCEPTED' ? { acceptedAt: clock.now() } : {}),
      },
    });

  const { notification } = delivery;
  if (notification.user.status !== 'ACTIVE') {
    await finish({ status: 'SKIPPED', lastError: 'Recipient account is not active' });
    return 'SKIPPED';
  }

  let content;
  try {
    content = await buildNotificationEmail(notification);
  } catch (error) {
    if (error instanceof EmailNotApplicable) {
      await finish({ status: 'SKIPPED', lastError: error.message });
      return 'SKIPPED';
    }
    // A template bug is not fixed by retrying.
    logger.error(
      { deliveryId, event: notification.event, errorName: (error as Error).name },
      'Notification email could not be rendered',
    );
    await finish({ status: 'FAILED', lastError: 'Email could not be rendered' });
    return 'FAILED';
  }

  try {
    const receipt = await emailService.sendNotification(
      notification.user.email,
      content,
      `notification-delivery/${deliveryId}`,
    );
    await finish({
      status: 'ACCEPTED',
      providerMessageId: receipt.providerMessageId,
      lastError: null,
    });
    return 'ACCEPTED';
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error;
    const permanent = isPermanentResendError(cause);
    const exhausted = delivery.attempts >= NOTIFICATION_EMAIL_MAX_ATTEMPTS;
    const lastError = describeFailure(error);
    if (permanent || exhausted) {
      await finish({ status: 'FAILED', lastError });
      logger.warn(
        { deliveryId, event: notification.event, lastError },
        'Notification email failed',
      );
      return 'FAILED';
    }
    await finish({
      status: 'PENDING',
      lastError,
      nextAttemptAt: new Date(clock.now().getTime() + delivery.attempts ** 2 * 60_000),
    });
    return 'RETRY';
  }
}

// --- After-commit dispatch ------------------------------------------------------------------

const inFlight = new Set<Promise<void>>();

/**
 * Sends freshly created deliveries right away, without delaying the HTTP response. Must be
 * called AFTER the transaction that created them has committed. Anything that fails here stays
 * PENDING and is retried by the sweep worker (long-running server) or the next dispatch.
 */
export function dispatchAfterCommit(deliveryIds: readonly string[]): void {
  if (deliveryIds.length === 0) return;
  const run = (async () => {
    for (const id of deliveryIds) {
      try {
        await deliverEmail(id);
      } catch (error) {
        logger.warn(
          { deliveryId: id, errorName: (error as Error).name },
          'Notification email dispatch error; left for retry',
        );
      }
    }
  })();
  inFlight.add(run);
  void run.finally(() => inFlight.delete(run));
}

/** Waits for after-commit dispatches started so far (tests and graceful shutdown). */
export async function settleNotificationDispatch(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

// --- Sweep worker ---------------------------------------------------------------------------

const SWEEP_BATCH = 50;

/** Sends due PENDING deliveries and reclaims abandoned SENDING ones. Returns how many it tried. */
export async function sweepNotificationEmails(): Promise<number> {
  const now = clock.now();
  const due = await prisma.notificationDelivery.findMany({
    where: {
      channel: 'EMAIL',
      attempts: { lt: NOTIFICATION_EMAIL_MAX_ATTEMPTS },
      OR: [
        { status: 'PENDING', nextAttemptAt: { lte: now } },
        {
          status: 'SENDING',
          claimedAt: { lt: new Date(now.getTime() - NOTIFICATION_EMAIL_CLAIM_LEASE_MS) },
        },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: SWEEP_BATCH,
    select: { id: true },
  });
  for (const row of due) await deliverEmail(row.id);
  // A SENDING row abandoned on its LAST attempt can never be claimed again: close it out.
  await prisma.notificationDelivery.updateMany({
    where: {
      status: 'SENDING',
      attempts: { gte: NOTIFICATION_EMAIL_MAX_ATTEMPTS },
      claimedAt: { lt: new Date(now.getTime() - NOTIFICATION_EMAIL_CLAIM_LEASE_MS) },
    },
    data: { status: 'FAILED', claimedAt: null, lastError: 'Abandoned during the last attempt' },
  });
  return due.length;
}

/** Started by the long-running server only (not on serverless; see docs/NOTIFICATIONS.md §6). */
export function startNotificationEmailWorker(intervalMs = NOTIFICATION_EMAIL_SWEEP_MS): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sweepNotificationEmails();
    } catch (error) {
      const { name, code } = error as { name?: string; code?: string };
      logger.warn({ errorName: name, errorCode: code }, 'Notification email sweep failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
