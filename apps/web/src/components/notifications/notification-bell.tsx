'use client';

import type { NotificationUnreadCountDto } from '@asra/types';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { bellLabel, notificationsPagePath, unreadBadgeText } from '@/lib/notifications';

/** Fired by the notifications page after marking items read, so the badge updates at once. */
export const NOTIFICATIONS_CHANGED_EVENT = 'asra:notifications-changed';

const POLL_MS = 60_000;

/**
 * Header entry point to the in-app notifications (PHASE 11): a link to the portal's
 * notifications page with an unread badge. The count is refreshed every minute, when the tab
 * regains focus and after the user reads notifications. A failed refresh keeps the last count.
 */
export function NotificationBell() {
  const { authorizedRequest } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = React.useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    const refresh = () => {
      authorizedRequest<NotificationUnreadCountDto>('/notifications/unread-count').then(
        (data) => active && setUnread(data.unread),
        () => undefined,
      );
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [authorizedRequest]);

  const badge = unreadBadgeText(unread);
  return (
    <Link
      href={notificationsPagePath(pathname)}
      aria-label={bellLabel(unread)}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Bell className="size-5" aria-hidden />
      {badge ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-none font-semibold text-accent-foreground tabular-nums"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
