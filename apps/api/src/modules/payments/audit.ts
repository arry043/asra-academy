import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Append-only financial audit trail (docs/PAYMENTS.md §11). Written in the same transaction as
 * the change it records. Contains ids, amounts and safe provider codes only — never secrets,
 * signatures, webhook bodies, card data, email addresses or phone numbers.
 */
export type PaymentAuditAction =
  | 'order.created'
  | 'order.provider_order_created'
  | 'order.paid'
  | 'order.expired'
  | 'order.cancelled'
  | 'order.reconciled'
  | 'payment.recorded'
  | 'payment.captured_by_platform'
  | 'payment.verification_failed'
  | 'payment.needs_review'
  | 'enrollment.activated'
  | 'enrollment.already_active'
  | 'enrollment.revoked_with_refund'
  | 'refund.requested'
  | 'refund.updated'
  | 'refund.discovered'
  | 'webhook.mode_mismatch';

export type PaymentAuditEntity = 'order' | 'payment' | 'refund' | 'enrollment' | 'webhook_event';

export async function paymentAudit(
  db: DbClient,
  entry: {
    action: PaymentAuditAction;
    actorId?: string | null;
    entityType: PaymentAuditEntity;
    entityId: string;
    data?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await db.paymentAuditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.data ? { data: entry.data } : {}),
    },
  });
}
