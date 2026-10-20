/**
 * In-app notifications (PHASE 11, docs/NOTIFICATIONS.md) — `/api/v1/notifications/*`.
 * Every payload belongs to the signed-in user; no endpoint returns another user's rows.
 */

export const NOTIFICATION_TYPES = [
  'REGISTRATION',
  'ENROLLMENT',
  'PAYMENT',
  'LIVE_CLASS',
  'ASSIGNMENT',
  'EXAMINATION',
  'RESULT',
  'CERTIFICATE',
  'ANNOUNCEMENT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationDto {
  id: string;
  type: NotificationType;
  /** Fine-grained event, e.g. "live_class.cancelled". */
  event: string;
  title: string;
  /** Plain text — render as text, never HTML. */
  message: string;
  /** App-relative path to open, or null. */
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationUnreadCountDto {
  unread: number;
}
