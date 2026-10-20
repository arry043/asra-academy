'use client';

import type { NotificationDto, Paginated } from '@asra/types';
import {
  Award,
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Megaphone,
  MonitorPlay,
  NotebookPen,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ErrorPanel, LoadingPanel } from '@/components/admin/admin-ui';
import { errorMessage, useApiResource } from '@/components/admin/use-admin';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import { notificationHref, relativeTime } from '@/lib/notifications';
import { cn } from '@/lib/utils';

import { NOTIFICATIONS_CHANGED_EVENT } from './notification-bell';

const ICONS: Record<NotificationDto['type'], React.ComponentType<{ className?: string }>> = {
  REGISTRATION: UserPlus,
  ENROLLMENT: GraduationCap,
  PAYMENT: CreditCard,
  LIVE_CLASS: MonitorPlay,
  ASSIGNMENT: NotebookPen,
  EXAMINATION: ClipboardList,
  RESULT: CalendarClock,
  CERTIFICATE: Award,
  ANNOUNCEMENT: Megaphone,
};

const announce = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

/**
 * The signed-in user's notifications (PHASE 11), shared by the student, faculty and admin
 * portals. Read state is the server's; opening a notification marks it read.
 */
export function NotificationsPage({ home }: { home: { label: string; href: string } }) {
  const { authorizedRequest } = useAuth();
  const [status, setStatus] = React.useState<'all' | 'unread'>('all');
  const [page, setPage] = React.useState(1);
  const [marking, setMarking] = React.useState(false);
  const path = `/notifications?status=${status}&page=${page}&pageSize=20`;
  const list = useApiResource(path, () => authorizedRequest<Paginated<NotificationDto>>(path));

  async function markRead(item: NotificationDto) {
    if (item.readAt) return;
    try {
      await authorizedRequest(`/notifications/${item.id}/read`, { method: 'POST' });
      announce();
      list.reload();
    } catch (error) {
      toast.error('Could not mark the notification as read', { description: errorMessage(error) });
    }
  }

  async function markAll() {
    setMarking(true);
    try {
      const result = await authorizedRequest<{ updated: number }>('/notifications/read-all', {
        method: 'POST',
      });
      announce();
      list.reload();
      toast.success(
        result.updated > 0 ? 'All notifications marked as read' : 'Nothing left to mark as read',
      );
    } catch (error) {
      toast.error('Could not mark notifications as read', { description: errorMessage(error) });
    } finally {
      setMarking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumbs={[home, { label: 'Notifications' }]}
        description="Updates about your account, courses, classes and results. Important ones are also emailed to you."
        actions={
          <Button variant="outline" onClick={markAll} loading={marking} loadingText="Marking…">
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        }
      />
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as 'all' | 'unread');
          setPage(1);
        }}
      >
        <TabsList aria-label="Which notifications">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading notifications…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={status === 'unread' ? <BellOff /> : <Bell />}
          title={status === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          description={
            status === 'unread'
              ? 'There are no unread notifications.'
              : 'Class schedules, enrolments, results and other updates will appear here.'
          }
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <ul className="grid gap-2">
            {list.data.items.map((item) => (
              <NotificationItem key={item.id} item={item} onRead={() => void markRead(item)} />
            ))}
          </ul>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Notification pages"
            />
          ) : null}
        </div>
      )}
    </>
  );
}

function NotificationItem({ item, onRead }: { item: NotificationDto; onRead: () => void }) {
  const Icon = ICONS[item.type] ?? Bell;
  const href = notificationHref(item);
  const unread = !item.readAt;
  const when = relativeTime(item.createdAt) ?? formatDateTime(item.createdAt);
  return (
    <li
      className={cn(
        'flex gap-3 rounded-xl border bg-card p-4',
        unread && 'border-asra-gold-500/60 bg-asra-gold-100/30',
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-5"
      >
        <Icon />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-label break-words text-heading">{item.title}</span>
          {unread ? <Badge variant="accent">New</Badge> : null}
        </span>
        <p className="type-body-sm break-words whitespace-pre-line">{item.message}</p>
        <span className="type-caption text-muted-foreground">
          <time dateTime={item.createdAt}>{when}</time>
        </span>
        <span className="mt-1 flex flex-wrap gap-2">
          {href ? (
            <Button asChild size="sm" variant="outline">
              <Link href={href} onClick={onRead}>
                Open
              </Link>
            </Button>
          ) : null}
          {unread ? (
            <Button size="sm" variant="ghost" onClick={onRead}>
              Mark as read
            </Button>
          ) : null}
        </span>
      </div>
    </li>
  );
}
