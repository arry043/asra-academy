import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Append-only audit trail for consequential assessment actions (docs/ASSESSMENTS.md §10). Written
 * inside the same transaction as the change it records, so an action and its audit row commit or
 * roll back together. Contains ids and marks only — no answer text or personal data.
 */
export type AuditAction =
  | 'quiz.published'
  | 'quiz.closed'
  | 'quiz.reopened'
  | 'quiz.unpublished'
  | 'quiz.results_published'
  | 'exam.published'
  | 'exam.closed'
  | 'exam.reopened'
  | 'exam.unpublished'
  | 'exam.results_published'
  | 'attempt.finalized'
  | 'attempt.answer_graded'
  | 'submission.resubmitted'
  | 'submission.graded'
  | 'submission.released';

export type AuditEntity = 'quiz' | 'examination' | 'attempt' | 'submission';

export async function audit(
  db: DbClient,
  entry: {
    action: AuditAction;
    actorId: string | null;
    entityType: AuditEntity;
    entityId: string;
    data?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await db.assessmentAuditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.data ? { data: entry.data } : {}),
    },
  });
}
