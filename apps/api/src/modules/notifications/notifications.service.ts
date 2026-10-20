import type { NotificationDto, NotificationUnreadCountDto, Paginated } from '@asra/types';
import type { NotificationListQuery } from '@asra/validation';
import { NOTIFICATION_FANOUT_BATCH } from '../../config/constants.js';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import type { NotificationType, Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';

/**
 * Notification creation and the recipient's inbox (PHASE 11, docs/NOTIFICATIONS.md).
 *
 * Business modules describe WHAT happened (`NotificationSpec`, built in events.ts) and WHO should
 * hear about it; this service persists one in-app row per recipient and, for emailed events, one
 * EMAIL outbox row per notification. Callers pass their transaction client, so the notification
 * commits — or rolls back — with the business change. Email is sent after commit
 * (dispatcher.ts); nothing here talks to a provider.
 *
 * Idempotent: (user, dedupeKey) is unique and inserts skip duplicates, so re-processing the same
 * event (a retried request, a duplicate webhook, a reconciliation pass) never creates a second
 * notification or a second email.
 */

export interface NotificationSpec {
  type: NotificationType;
  /** "family.action", e.g. "live_class.scheduled" (CHECK `notifications_event_format`). */
  event: string;
  title: string;
  message: string;
  /** App-relative path ("/student/classes"); never an external URL. */
  actionUrl?: string | null;
  resource?: { type: string; id: string } | null;
  /** Non-sensitive details for the email template. */
  data?: Prisma.InputJsonValue;
  /** Identifies the event occurrence; unique per recipient. */
  dedupeKey: string;
  /** Also email it (in-app is always created). */
  email: boolean;
}

/** Trims text to a column's size without cutting inside a surrogate pair. */
export function clip(value: string, max: number): string {
  const chars = Array.from(value.trim());
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`;
}

/**
 * Creates the notification for each recipient (duplicates skipped) and returns the ids of the
 * EMAIL deliveries that were created — hand them to `dispatchAfterCommit` once the transaction
 * has committed.
 */
export async function notifyUsers(
  db: DbClient,
  userIds: readonly string[],
  spec: NotificationSpec,
): Promise<string[]> {
  const recipients = [...new Set(userIds)];
  const deliveryIds: string[] = [];
  for (let start = 0; start < recipients.length; start += NOTIFICATION_FANOUT_BATCH) {
    const batch = recipients.slice(start, start + NOTIFICATION_FANOUT_BATCH);
    const created = await db.notification.createManyAndReturn({
      data: batch.map((userId) => ({
        userId,
        type: spec.type,
        event: spec.event,
        title: clip(spec.title, 200),
        message: clip(spec.message, 1000),
        actionUrl: spec.actionUrl ?? null,
        resourceType: spec.resource?.type ?? null,
        resourceId: spec.resource?.id ?? null,
        ...(spec.data === undefined ? {} : { data: spec.data }),
        dedupeKey: clip(spec.dedupeKey, 200),
      })),
      skipDuplicates: true,
      select: { id: true },
    });
    if (!spec.email || created.length === 0) continue;
    const deliveries = await db.notificationDelivery.createManyAndReturn({
      data: created.map((row) => ({ notificationId: row.id, channel: 'EMAIL' as const })),
      skipDuplicates: true,
      select: { id: true },
    });
    deliveryIds.push(...deliveries.map((row) => row.id));
  }
  return deliveryIds;
}

/**
 * Students who may currently see a course's content: ACTIVE enrolment in a PUBLISHED course and an
 * ACTIVE account — the same entitlement as the student portal (docs/STUDENT-LMS.md §2).
 */
export async function eligibleStudentIds(db: DbClient, courseId: string): Promise<string[]> {
  const rows = await db.enrollment.findMany({
    where: {
      courseId,
      status: 'ACTIVE',
      course: { status: 'PUBLISHED' },
      user: { status: 'ACTIVE' },
    },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

const notificationSelect = {
  id: true,
  type: true,
  event: true,
  title: true,
  message: true,
  actionUrl: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    event: row.event,
    title: row.title,
    message: row.message,
    actionUrl: row.actionUrl,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The signed-in user's inbox. Every query is scoped to `auth.userId` — never a request value. */
export const notificationService = {
  async list(auth: AuthContext, query: NotificationListQuery): Promise<Paginated<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = {
      userId: auth.userId,
      ...(query.status === 'unread' ? { readAt: null } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  },

  async unreadCount(auth: AuthContext): Promise<NotificationUnreadCountDto> {
    return {
      unread: await prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    };
  },

  /** Idempotent. Another user's id is indistinguishable from an unknown one (404). */
  async markRead(auth: AuthContext, id: string): Promise<NotificationDto> {
    await prisma.notification.updateMany({
      where: { id, userId: auth.userId, readAt: null },
      data: { readAt: clock.now() },
    });
    const row = await prisma.notification.findFirst({
      where: { id, userId: auth.userId },
      select: notificationSelect,
    });
    if (!row) throw new AppError('NOT_FOUND', 'Notification not found');
    return toDto(row);
  },

  async markAllRead(auth: AuthContext): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: clock.now() },
    });
    return { updated: result.count };
  },
};
