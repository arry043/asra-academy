import { randomUUID } from 'node:crypto';
import type { AdminRefundDto } from '@asra/types';
import type { RefundCreateInput } from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { paymentAudit } from './audit.js';
import { paymentsConfig } from './config.js';
import { applyProviderRefund } from './core.js';
import { PaymentGatewayError } from './gateway.js';
import { adminRefundSelect, toAdminRefund } from './mappers.js';
import { sendRefundNoticeOnce } from './notifications.js';

/**
 * Administrator refunds through the Razorpay Refunds API (docs/PAYMENTS.md §11).
 *
 *   1. In ONE transaction (payment row locked): check the payment is CAPTURED and the amount fits
 *      the remaining refundable balance (captured − processed − in-flight), then write a
 *      REQUESTED refund with a unique `receipt` — BEFORE calling the provider.
 *   2. Call Razorpay with that receipt. Razorpay refuses a second refund with the same receipt on a
 *      payment, so retrying after a timeout or crash can never refund twice.
 *   3. Record the provider's answer; webhooks/reconciliation move it to PROCESSED or FAILED.
 *
 * The original payment row is never rewritten (only its `refunded_minor` total follows PROCESSED
 * refunds). A refund does NOT revoke course access unless the administrator explicitly asks for it
 * (`revokeAccess`) — N-03 is pending.
 */

/** A REQUESTED refund whose provider call outcome is unknown is re-checked after this delay. */
const RESUBMIT_AFTER_MS = 2 * 60_000;

const receiptFor = (refundId: string) => `RF-${refundId.replace(/-/g, '')}`; // 35 chars ≤ 40

async function refundDto(id: string): Promise<AdminRefundDto> {
  return toAdminRefund(
    await prisma.refund.findUniqueOrThrow({ where: { id }, select: adminRefundSelect }),
  );
}

/** Sends a REQUESTED refund to Razorpay (safe to repeat: the receipt is the idempotency key). */
async function submit(refundId: string): Promise<void> {
  const refund = await prisma.refund.findUniqueOrThrow({
    where: { id: refundId },
    include: {
      payment: {
        select: {
          id: true,
          providerPaymentId: true,
          mode: true,
          order: { select: { reference: true } },
        },
      },
    },
  });
  if (refund.status !== 'REQUESTED' || !refund.receipt) return;
  const { gateway } = paymentsConfig.requireAccount(refund.payment.mode);
  try {
    const providerRefund = await gateway.createRefund(refund.payment.providerPaymentId, {
      amountMinor: refund.amountMinor,
      receipt: refund.receipt,
      notes: { refundId: refund.id, orderReference: refund.payment.order.reference },
    });
    const result = await applyProviderRefund(refund.payment.id, providerRefund);
    if (result.justProcessed) await sendRefundNoticeOnce(result.refundId);
  } catch (error) {
    if (!(error instanceof PaymentGatewayError)) throw error;
    if (error.kind === 'REJECTED') {
      // Either it already exists (duplicate receipt from an earlier, lost response) or Razorpay
      // refused it. Look it up by receipt before concluding.
      const found = (await gateway.fetchPaymentRefunds(refund.payment.providerPaymentId)).find(
        (item) => item.receipt === refund.receipt,
      );
      if (found) {
        const result = await applyProviderRefund(refund.payment.id, found);
        if (result.justProcessed) await sendRefundNoticeOnce(result.refundId);
        return;
      }
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'FAILED',
          failureReason: (
            error.providerDescription ?? 'The payment provider refused the refund.'
          ).slice(0, 500),
        },
      });
      await paymentAudit(prisma, {
        action: 'refund.updated',
        entityType: 'refund',
        entityId: refund.id,
        data: { from: 'REQUESTED', to: 'FAILED', providerCode: error.providerCode ?? null },
      });
      return;
    }
    // Outcome unknown (timeout/5xx): stays REQUESTED; `reconcile` re-checks by receipt.
    logger.warn({ refundId: refund.id, kind: error.kind }, 'Refund submission outcome unknown');
  }
}

export const refundsService = {
  async request(
    auth: AuthContext,
    paymentId: string,
    input: RefundCreateInput,
  ): Promise<AdminRefundDto> {
    const repeated = await prisma.refund.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (repeated) {
      if (repeated.paymentId !== paymentId) {
        throw new AppError('CONFLICT', 'This request key was already used for another refund.');
      }
      return refundDto(repeated.id);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { mode: true },
    });
    if (!payment) throw new AppError('NOT_FOUND', 'Payment not found');
    paymentsConfig.requireAccount(payment.mode); // fail before writing anything

    let refundId: string;
    let created = true;
    try {
      refundId = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${paymentId}::uuid FOR UPDATE`;
        // Re-checked under the lock: an identical concurrent request may have just committed.
        const winner = await tx.refund.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) {
          if (winner.paymentId !== paymentId) {
            throw new AppError('CONFLICT', 'This request key was already used for another refund.');
          }
          created = false;
          return winner.id;
        }
        const row = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: {
            refunds: {
              where: { status: { in: ['REQUESTED', 'PENDING'] } },
              select: { amountMinor: true },
            },
          },
        });
        if (row.status !== 'CAPTURED') {
          throw new AppError('CONFLICT', 'Only a captured payment can be refunded.');
        }
        const inFlight = row.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0);
        const refundable = row.amountMinor - row.refundedMinor - inFlight;
        if (refundable <= 0)
          throw new AppError('CONFLICT', 'This payment has nothing left to refund.');
        const amountMinor = input.amountMinor ?? refundable;
        if (amountMinor > refundable) {
          throw fieldError(
            'VALIDATION_ERROR',
            'amountMinor',
            `At most ${refundable} paise can still be refunded on this payment.`,
          );
        }
        const id = randomUUID();
        await tx.refund.create({
          data: {
            id,
            paymentId,
            provider: row.provider,
            mode: row.mode,
            receipt: receiptFor(id),
            idempotencyKey: input.idempotencyKey,
            amountMinor,
            currency: row.currency,
            status: 'REQUESTED',
            reason: input.reason,
            requestedById: auth.userId,
            revokedAccess: input.revokeAccess,
          },
        });
        await paymentAudit(tx, {
          action: 'refund.requested',
          actorId: auth.userId,
          entityType: 'refund',
          entityId: id,
          data: { paymentId, amountMinor, revokeAccess: input.revokeAccess },
        });
        if (input.revokeAccess) {
          // Explicit administrator decision, recorded with the refund. Only the enrolment that
          // THIS payment's order activated is cancelled; progress history is kept.
          const order = await tx.order.findUniqueOrThrow({
            where: { id: row.orderId },
            select: { userId: true, courseId: true },
          });
          const enrollment = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
          });
          if (enrollment?.status === 'ACTIVE' && enrollment.orderId === row.orderId) {
            await tx.enrollment.update({
              where: { id: enrollment.id },
              data: { status: 'CANCELLED', cancelledAt: clock.now() },
            });
            await paymentAudit(tx, {
              action: 'enrollment.revoked_with_refund',
              actorId: auth.userId,
              entityType: 'enrollment',
              entityId: enrollment.id,
              data: { refundId: id },
            });
          }
        }
        return id;
      });
    } catch (error) {
      // A concurrent identical request (same idempotency key) won the insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        let winner = await prisma.refund.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        for (let i = 0; i < 15 && winner?.status === 'REQUESTED'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          winner = await prisma.refund.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });
        }
        if (winner) return refundDto(winner.id);
      }
      throw error;
    }

    if (created) await submit(refundId);
    return refundDto(refundId);
  },

  /** Re-reads one refund from Razorpay (and re-submits a REQUESTED one whose outcome is unknown). */
  async reconcile(refundId: string): Promise<AdminRefundDto> {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: { select: { id: true, providerPaymentId: true, mode: true } } },
    });
    if (!refund) throw new AppError('NOT_FOUND', 'Refund not found');
    if (refund.status === 'PROCESSED') return refundDto(refund.id);
    const { gateway } = paymentsConfig.requireAccount(refund.payment.mode);
    const found = (await gateway.fetchPaymentRefunds(refund.payment.providerPaymentId)).find(
      (item) =>
        (refund.providerRefundId && item.id === refund.providerRefundId) ||
        (refund.receipt !== null && item.receipt === refund.receipt),
    );
    if (found) {
      const result = await applyProviderRefund(refund.payment.id, found);
      if (result.justProcessed) await sendRefundNoticeOnce(result.refundId);
    } else if (
      refund.status === 'REQUESTED' &&
      clock.now().getTime() - refund.createdAt.getTime() >= RESUBMIT_AFTER_MS
    ) {
      await submit(refund.id);
    }
    return refundDto(refund.id);
  },
};
