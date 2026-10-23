'use client';

import { PERMISSIONS, type AdminDashboardDto } from '@asra/types';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  IndianRupee,
  MonitorPlay,
  Plus,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { auditActionLabel, compareCounts, formatCount, USER_STATUS } from '@/lib/admin/analytics';
import { formatDateTime } from '@/lib/format';
import { formatAmount, MODE_LABEL, ORDER_STATUS } from '@/lib/payments';

import { KpiCard, Section } from './admin-kit';
import { ErrorPanel } from './admin-ui';
import { errorMessage, hasPermission, useAdminApi, useApiResource } from './use-admin';

/**
 * Admin dashboard (PHASE 12, docs/ADMIN-DASHBOARD.md §3). Every number is computed by the API from
 * database rows; sections the administrator may not see arrive as `null` and are not rendered.
 * Administrators without `analytics.view` see shortcuts to the areas they can manage.
 */
export function AdminOverview() {
  const { user } = useAuth();
  const api = useAdminApi();
  const can = (permission: string) => hasPermission(user, permission);
  const canAnalytics = can(PERMISSIONS.ANALYTICS_VIEW);
  const dashboard = useApiResource(canAnalytics ? '/admin/dashboard' : null, () =>
    api.get<AdminDashboardDto>('/admin/dashboard'),
  );
  const d = dashboard.data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName.split(' ')[0] ?? 'admin'}`}
        description="Academic operations, learning activity and payments at a glance."
        actions={
          can(PERMISSIONS.COURSES_MANAGE) ? (
            <Button asChild>
              <Link href="/admin/courses/new">
                <Plus aria-hidden /> New course
              </Link>
            </Button>
          ) : null
        }
      />

      {!canAnalytics ? (
        <Shortcuts can={can} />
      ) : dashboard.error && !d ? (
        <ErrorPanel message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
      ) : (
        <>
          <Kpis d={d} />
          {d ? <Attention d={d} /> : null}
          {d ? <Lists d={d} /> : null}
          {d ? (
            <p className="type-caption text-muted-foreground">
              Figures as of {formatDateTime(d.generatedAt)}. Definitions:{' '}
              <Link href="/admin/analytics" className="text-primary underline">
                Analytics
              </Link>{' '}
              and docs/ADMIN-DASHBOARD.md.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

function Kpis({ d }: { d: AdminDashboardDto | undefined }) {
  const k = d?.kpis;
  const revenue = k?.revenue;
  const inr = revenue?.totals.find((t) => t.currency === 'INR') ?? revenue?.totals[0];
  const inr30 = revenue?.last30Days.find((t) => t.currency === (inr?.currency ?? 'INR'));
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={!d || undefined}>
      <KpiCard
        title="Students"
        icon={<GraduationCap />}
        href="/admin/students"
        value={k?.students ? formatCount(k.students.total) : d ? '—' : undefined}
        hint={k?.students ? `${formatCount(k.students.active)} active accounts` : undefined}
        delta={
          k?.students
            ? compareCounts(
                k.students.registrations.current,
                k.students.registrations.previous,
                'registrations',
              )
            : undefined
        }
        deltaLabel="new in 30 days vs previous 30"
      />
      <KpiCard
        title="Faculty"
        icon={<UserRoundCheck />}
        href="/admin/faculty"
        value={k?.faculty ? formatCount(k.faculty.total) : d ? '—' : undefined}
        hint={k?.faculty ? `${formatCount(k.faculty.active)} active accounts` : undefined}
      />
      <KpiCard
        title="Courses"
        icon={<BookOpen />}
        href="/admin/courses"
        value={k?.courses ? formatCount(k.courses.total) : d ? '—' : undefined}
        hint={
          k?.courses
            ? `${k.courses.published} published · ${k.courses.draft} draft · ${k.courses.archived} archived`
            : undefined
        }
      />
      <KpiCard
        title="Enrolments"
        icon={<Users />}
        href="/admin/enrollments"
        value={k?.enrollments ? formatCount(k.enrollments.total) : d ? '—' : undefined}
        hint={k?.enrollments ? `${formatCount(k.enrollments.active)} currently active` : undefined}
        delta={
          k?.enrollments
            ? compareCounts(
                k.enrollments.newEnrollments.current,
                k.enrollments.newEnrollments.previous,
                'enrolments',
              )
            : undefined
        }
        deltaLabel="new in 30 days vs previous 30"
      />
      {d && revenue === null ? null : (
        <KpiCard
          title="Net revenue (all time)"
          icon={<IndianRupee />}
          href="/admin/analytics/revenue"
          value={revenue ? formatAmount(inr?.netMinor ?? 0, inr?.currency ?? 'INR') : undefined}
          hint={
            revenue
              ? `${MODE_LABEL[revenue.mode]} · captured − refunded, before Razorpay fees`
              : undefined
          }
          delta={
            inr30
              ? {
                  text: formatAmount(inr30.currentNetMinor, inr30.currency),
                  direction:
                    inr30.currentNetMinor > inr30.previousNetMinor
                      ? 'up'
                      : inr30.currentNetMinor < inr30.previousNetMinor
                        ? 'down'
                        : 'flat',
                  description: `${formatAmount(inr30.currentNetMinor, inr30.currency)} net in the last 30 days vs ${formatAmount(inr30.previousNetMinor, inr30.currency)} in the 30 days before`,
                }
              : undefined
          }
          deltaLabel={
            inr30
              ? `last 30 days (prev. ${formatAmount(inr30.previousNetMinor, inr30.currency)})`
              : undefined
          }
        />
      )}
      <KpiCard
        title="Upcoming live classes"
        icon={<MonitorPlay />}
        href="/admin/live-classes"
        value={k?.liveClasses ? formatCount(k.liveClasses.upcoming) : d ? '—' : undefined}
        hint={k?.liveClasses ? `${k.liveClasses.next7Days} in the next 7 days` : undefined}
      />
      <KpiCard
        title="Work awaiting grading"
        icon={<ClipboardCheck />}
        href="/admin/assessments"
        value={
          k?.pendingWork
            ? formatCount(
                k.pendingWork.submissionsAwaitingReview + k.pendingWork.attemptsAwaitingGrading,
              )
            : d
              ? '—'
              : undefined
        }
        hint={
          k?.pendingWork
            ? `${k.pendingWork.submissionsAwaitingReview} submissions · ${k.pendingWork.attemptsAwaitingGrading} written answers`
            : undefined
        }
      />
      <KpiCard
        title="Examinations"
        icon={<FileCheck2 />}
        href="/admin/assessments/exams"
        value={
          k?.examinations
            ? formatCount(k.examinations.upcoming + k.examinations.open)
            : d
              ? '—'
              : undefined
        }
        hint={
          k?.examinations
            ? `${k.examinations.open} open now · ${k.examinations.upcoming} scheduled · ${k.examinations.awaitingResults} awaiting results`
            : undefined
        }
      />
    </dl>
  );
}

function Attention({ d }: { d: AdminDashboardDto }) {
  const a = d.attention;
  const items = [
    a.paymentsNeedingReview
      ? {
          text: `${a.paymentsNeedingReview} captured payment(s) need review`,
          href: '/admin/payments',
        }
      : null,
    a.failedPaymentsLast7Days
      ? {
          text: `${a.failedPaymentsLast7Days} failed payment attempt(s) in the last 7 days`,
          href: '/admin/payments',
        }
      : null,
    a.failedEmails
      ? { text: `${a.failedEmails} email(s) failed to send`, href: '/admin/email-deliveries' }
      : null,
    a.liveClassesWithMeetingErrors
      ? {
          text: `${a.liveClassesWithMeetingErrors} upcoming class(es) without a Google Meet link`,
          href: '/admin/live-classes',
        }
      : null,
  ].filter((item) => item !== null);
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="attention-title"
      className="grid gap-2 rounded-xl border border-warning/40 bg-warning-soft p-4"
    >
      <h2 id="attention-title" className="flex items-center gap-2 type-h4 text-heading">
        <AlertTriangle className="size-5 text-warning" aria-hidden /> Needs attention
      </h2>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.text}>
            <Link
              href={item.href}
              className="type-body-sm text-foreground underline-offset-2 hover:underline"
            >
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const empty = (text: string) => <p className="type-body-sm text-muted-foreground">{text}</p>;

function Lists({ d }: { d: AdminDashboardDto }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {d.recentStudents ? (
        <Section title="Recent registrations" href="/admin/students">
          {d.recentStudents.length === 0 ? (
            empty('No students have registered yet.')
          ) : (
            <ul className="grid divide-y">
              {d.recentStudents.map((s) => (
                <li key={s.userId} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/admin/users/${s.userId}`}
                    className="grid min-w-0 hover:text-primary"
                  >
                    <span className="truncate type-label">{s.fullName}</span>
                    <span className="truncate type-caption text-muted-foreground">{s.email}</span>
                  </Link>
                  <span className="grid justify-items-end gap-1">
                    <Badge variant={USER_STATUS[s.status].tone}>
                      {USER_STATUS[s.status].label}
                    </Badge>
                    <span className="type-caption text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {d.recentOrders ? (
        <Section title="Recent orders" href="/admin/payments">
          {d.recentOrders.length === 0 ? (
            empty('No orders yet.')
          ) : (
            <ul className="grid divide-y">
              {d.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/admin/payments/orders/${o.id}`}
                    className="grid min-w-0 hover:text-primary"
                  >
                    <span className="truncate type-label">{o.course.title}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {o.reference} · {o.student.fullName}
                    </span>
                  </Link>
                  <span className="grid justify-items-end gap-1">
                    <span className="type-label tabular-nums">
                      {formatAmount(o.amountMinor, o.currency)}
                    </span>
                    <Badge variant={ORDER_STATUS[o.status].tone}>
                      {ORDER_STATUS[o.status].label}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {d.upcomingLiveClasses ? (
        <Section title="Upcoming live classes" href="/admin/live-classes">
          {d.upcomingLiveClasses.length === 0 ? (
            empty('No live classes are scheduled.')
          ) : (
            <ul className="grid divide-y">
              {d.upcomingLiveClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="grid min-w-0">
                    <span className="truncate type-label">{c.title}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {c.course.title}
                      {c.host ? ` · ${c.host}` : ''}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <span className="type-caption">{formatDateTime(c.startsAt)}</span>
                    {c.hasJoinLink ? null : (
                      <Badge variant="warning" title={c.meetingLastError ?? undefined}>
                        No joining link
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {d.pendingReviews ? (
        <Section
          title="Oldest submissions awaiting a grade"
          description="Graded by the course faculty in the faculty portal."
          href="/admin/assessments"
        >
          {d.pendingReviews.length === 0 ? (
            empty('Nothing is waiting to be graded.')
          ) : (
            <ul className="grid divide-y">
              {d.pendingReviews.map((r) => (
                <li key={r.submissionId} className="flex items-center justify-between gap-3 py-2">
                  <span className="grid min-w-0">
                    <span className="truncate type-label">{r.assignmentTitle}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {r.course.title}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <span className="type-caption">Submitted {formatDateTime(r.submittedAt)}</span>
                    {r.late ? <Badge variant="warning">Late</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {d.upcomingExams ? (
        <Section title="Upcoming and open examinations" href="/admin/assessments/exams">
          {d.upcomingExams.length === 0 ? (
            empty('No published examinations are open or scheduled.')
          ) : (
            <ul className="grid divide-y">
              {d.upcomingExams.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="grid min-w-0">
                    <span className="truncate type-label">{e.title}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {e.course.title}
                    </span>
                  </span>
                  <span className="text-right type-caption">
                    {formatDateTime(e.opensAt)}
                    <br />– {formatDateTime(e.closesAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {d.recentActivity ? (
        <Section title="Recent administrative activity" href="/admin/audit-logs">
          {d.recentActivity.length === 0 ? (
            empty('No administrative actions have been recorded yet.')
          ) : (
            <ul className="grid divide-y">
              {d.recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="grid min-w-0">
                    <span className="truncate type-label">{auditActionLabel(entry.action)}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {entry.actor?.fullName ?? 'System'}
                    </span>
                  </span>
                  <span className="type-caption">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}

function Shortcuts({ can }: { can: (permission: string) => boolean }) {
  const items = [
    can(PERMISSIONS.COURSES_MANAGE) && {
      href: '/admin/courses',
      icon: <BookOpen />,
      title: 'Courses',
      text: 'Create, assign faculty, build curriculum and publish.',
    },
    can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE) && {
      href: '/admin/classes',
      icon: <GraduationCap />,
      title: 'Academic structure',
      text: 'Academic levels, classes, streams and subjects.',
    },
    can(PERMISSIONS.LIVE_CLASSES_MANAGE) && {
      href: '/admin/live-classes',
      icon: <MonitorPlay />,
      title: 'Live classes',
      text: 'Schedule classes and add recordings.',
    },
    can(PERMISSIONS.PAYMENTS_VIEW) && {
      href: '/admin/payments',
      icon: <IndianRupee />,
      title: 'Payments',
      text: 'Orders, payments and refunds.',
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group grid gap-2 rounded-xl border bg-card p-5 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-5"
          >
            {item.icon}
          </span>
          <span className="type-h4 text-heading group-hover:text-primary">{item.title}</span>
          <span className="type-body-sm text-muted-foreground">{item.text}</span>
        </Link>
      ))}
      {items.length === 0 ? (
        <p className="flex items-center gap-2 type-body text-muted-foreground">
          <BarChart3 className="size-5" aria-hidden /> Your role has no dashboard sections yet.
        </p>
      ) : null}
    </div>
  );
}
