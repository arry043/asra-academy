import type { NotificationDto } from '@asra/types';

/**
 * Pure helpers for the in-app notifications UI (PHASE 11). No React, no fetching — shared by
 * components and the web tests. The API scopes every notification to the signed-in user.
 */

/** "9+" style badge text; null hides the badge. */
export function unreadBadgeText(count: number | null | undefined, max = 9): string | null {
  if (!count || count <= 0) return null;
  return count > max ? `${max}+` : String(count);
}

/** Accessible name of the bell, e.g. "Notifications, 3 unread". */
export function bellLabel(count: number | null | undefined): string {
  if (!count || count <= 0) return 'Notifications';
  return `Notifications, ${count} unread`;
}

/**
 * The app-relative path a notification opens. Anything that is not a same-site path ("/x",
 * never "//host" or "https://…") is ignored, so a notification can never navigate off-site.
 */
export function notificationHref(item: Pick<NotificationDto, 'actionUrl'>): string | null {
  const url = item.actionUrl;
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return null;
  return url;
}

/** Notifications page of the portal the user is in. */
export function notificationsPagePath(pathname: string | null | undefined): string {
  if (pathname?.startsWith('/admin')) return '/admin/notifications';
  if (pathname?.startsWith('/faculty')) return '/faculty/notifications';
  return '/student/notifications';
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" — or null beyond a week (show the date). */
export function relativeTime(iso: string, now: number = Date.now()): string | null {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return null;
}
