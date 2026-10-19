import { prisma } from '../../database/prisma.js';
import { emailService } from '../../email/email.service.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';

/**
 * Transactional payment emails (docs/PAYMENTS.md §12), decoupled from the payment transaction:
 * the email is sent only AFTER the order is PAID and the enrolment committed, and a failed email
 * never rolls back or blocks a payment.
 *
 * Exactly-once (best effort): a process first CLAIMS the order with a conditional UPDATE — only
 * one concurrent caller (callback, webhook, duplicate webhook, reconciliation) can win — then
 * sends. A failure releases the claim so the reconciliation worker can retry (bounded attempts).
 * A claim left by a crashed process is reclaimed after CLAIM_LEASE_MS.
 */

const CLAIM_LEASE_MS = 10 * 60_000;
export const MAX_CONFIRMATION_EMAIL_ATTEMPTS = 5;

export async function sendOrderConfirmationOnce(
  orderId: string,
): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
  const now = clock.now();
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: 'PAID',
      confirmationEmailSentAt: null,
      confirmationEmailAttempts: { lt: MAX_CONFIRMATION_EMAIL_ATTEMPTS },
      OR: [
        { confirmationEmailClaimedAt: null },
        { confirmationEmailClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } },
      ],
    },
    data: { confirmationEmailClaimedAt: now, confirmationEmailAttempts: { increment: 1 } },
  });
  if (claimed.count === 0) return 'SKIPPED';

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      reference: true,
      courseTitle: true,
      amountMinor: true,
      currency: true,
      student: { select: { email: true, fullName: true } },
    },
  });
  try {
    await emailService.sendPaymentConfirmation(order.student.email, {
      fullName: order.student.fullName,
      courseTitle: order.courseTitle,
      orderReference: order.reference,
      amountMinor: order.amountMinor,
      currency: order.currency,
      orderId: order.id,
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { confirmationEmailSentAt: clock.now() },
    });
    return 'SENT';
  } catch {
    // emailService already logged the provider error (without the message body).
    await prisma.order.update({
      where: { id: orderId },
      data: { confirmationEmailClaimedAt: null },
    });
    logger.warn({ orderId }, 'Payment confirmation email not sent; will retry');
    return 'FAILED';
  }
}

/** Refund-processed email, once per refund (claimed through `notifiedAt`). */
export async function sendRefundNoticeOnce(refundId: string): Promise<void> {
  const claimed = await prisma.refund.updateMany({
    where: { id: refundId, status: 'PROCESSED', notifiedAt: null },
    data: { notifiedAt: clock.now() },
  });
  if (claimed.count === 0) return;
  const refund = await prisma.refund.findUniqueOrThrow({
    where: { id: refundId },
    select: {
      amountMinor: true,
      currency: true,
      payment: {
        select: {
          order: {
            select: {
              reference: true,
              courseTitle: true,
              student: { select: { email: true, fullName: true } },
            },
          },
        },
      },
    },
  });
  const { order } = refund.payment;
  try {
    await emailService.sendRefundProcessed(order.student.email, {
      fullName: order.student.fullName,
      courseTitle: order.courseTitle,
      orderReference: order.reference,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
    });
  } catch {
    // Informational only; release so a later sync can retry.
    await prisma.refund.update({ where: { id: refundId }, data: { notifiedAt: null } });
  }
}
