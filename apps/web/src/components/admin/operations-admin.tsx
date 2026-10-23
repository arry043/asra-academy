'use client';

import type {
  AdminAssignmentItem,
  AdminAuditEntryDto,
  AdminEnrollmentListItem,
  AdminExamItem,
  AdminNotificationDeliveryItem,
  AdminNotificationSummaryDto,
  AdminQuizItem,
  AdminRolesDto,
  AuditSource,
  NotificationDeliveryStatus,
} from '@asra/types';
import { ClipboardList, History, Mail, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auditActionLabel, formatCount, roleLabel } from '@/lib/admin/analytics';
import { formatDate, formatDateTime } from '@/lib/format';

import {
  FilterSelect,
  KpiCard,
  ListFrame,
  SearchBox,
  Section,
  SubNav,
  usePagedList,
} from './admin-kit';
import { ErrorPanel, LoadingPanel, StatusBadge } from './admin-ui';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

/**
 * Cross-course operational lists (PHASE 12, docs/ADMIN-DASHBOARD.md §6): enrolments, assessments,
 * email delivery, roles and audit logs. Read-only views — changes stay in their own workflows
 * (course enrolments, the faculty portal's grading, the notification dispatcher), so no business
 * rule is reimplemented here.
 */

const overview = { label: 'Overview', href: '/admin' };

// --- Enrolments -----------------------------------------------------------------------------

const SOURCE_LABEL = { PAYMENT: 'Online payment', FREE: 'Free', ADMIN: 'Administrator' } as const;

export function EnrollmentsAdmin() {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [source, setSource] = React.useState('');
  const [completed, setCompleted] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const { list, setPage } = usePagedList<AdminEnrollmentListItem>('/admin/enrollments', {
    q,
    status,
    source,
    completed,
    from,
    to,
  });
  return (
    <>
      <PageHeader
        title="Enrolments"
        description="Enrolments across every course. Enrol or cancel students from the course page."
        breadcrumbs={[overview, { label: 'Enrolments' }]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <SearchBox id="enrol-q" placeholder="Student, email or course" onSearch={setQ} />
        <FilterSelect
          id="enrol-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        <FilterSelect
          id="enrol-source"
          label="Source"
          value={source}
          onChange={setSource}
          options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          id="enrol-completed"
          label="Completion"
          value={completed}
          onChange={setCompleted}
          options={[
            { value: 'true', label: 'Completed' },
            { value: 'false', label: 'Not completed' },
          ]}
        />
        <Field id="enrol-from" label="Enrolled from">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="enrol-to" label="Enrolled to">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>
      <ListFrame list={list} setPage={setPage} label="enrolments" icon={<Users />}>
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/admin/users/${e.student.userId}`}
                      className="grid hover:text-primary"
                    >
                      <span className="font-medium">{e.student.fullName}</span>
                      <span className="type-caption text-muted-foreground">{e.student.email}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/courses/${e.course.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {e.course.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {e.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                    </Badge>
                    {e.completedAt ? (
                      <Badge variant="info" className="ml-1">
                        Completed
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="type-caption">
                    {SOURCE_LABEL[e.source]}
                    {e.orderReference ? (
                      <span className="block text-muted-foreground">{e.orderReference}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="type-caption">{formatDate(e.enrolledAt)}</TableCell>
                  <TableCell className="type-caption">
                    {e.lastActivityAt ? formatDateTime(e.lastActivityAt) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>
      <p className="type-caption text-muted-foreground">
        Dates are calendar days in IST. “Enrolled” is the latest activation of the enrolment.
      </p>
    </>
  );
}

// --- Assessments ----------------------------------------------------------------------------

type AssessmentKind = 'assignments' | 'quizzes' | 'exams';

const ASSESSMENT_STATUS_OPTIONS: Record<AssessmentKind, { value: string; label: string }[]> = {
  assignments: [
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ARCHIVED', label: 'Archived' },
  ],
  quizzes: [
    { value: 'PUBLISHED', label: 'Open' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CLOSED', label: 'Closed' },
  ],
  exams: [
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CLOSED', label: 'Closed' },
  ],
};

const ASSESSMENT_BADGE = {
  DRAFT: { label: 'Draft', tone: 'warning' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'secondary' },
} as const;

export function AssessmentsAdmin({ kind }: { kind: AssessmentKind }) {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [pending, setPending] = React.useState('');
  const title = { assignments: 'Assignments', quizzes: 'Quizzes', exams: 'Examinations' }[kind];
  return (
    <>
      <PageHeader
        title="Assessments"
        description="Assignments, quizzes and examinations of every course. Faculty create, grade and release them in the faculty portal; this view shows their state."
        breadcrumbs={[
          overview,
          { label: 'Assessments', href: '/admin/assessments' },
          { label: title },
        ]}
      />
      <SubNav
        label="Assessment types"
        items={[
          { href: '/admin/assessments', label: 'Assignments', exact: true },
          { href: '/admin/assessments/quizzes', label: 'Quizzes' },
          { href: '/admin/assessments/exams', label: 'Examinations' },
        ]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <SearchBox id={`${kind}-q`} placeholder="Title or course" onSearch={setQ} />
        <FilterSelect
          id={`${kind}-status`}
          label="Status"
          value={status}
          onChange={setStatus}
          options={ASSESSMENT_STATUS_OPTIONS[kind]}
        />
        <FilterSelect
          id={`${kind}-pending`}
          label="Grading"
          value={pending}
          onChange={setPending}
          options={[{ value: 'true', label: 'Work awaiting a grade' }]}
          allLabel="Any"
        />
      </div>
      {kind === 'assignments' ? (
        <AssignmentList q={q} status={status} pending={pending} />
      ) : kind === 'quizzes' ? (
        <QuizList q={q} status={status} pending={pending} />
      ) : (
        <ExamList q={q} status={status} pending={pending} />
      )}
    </>
  );
}

interface ListProps {
  q: string;
  status: string;
  pending: string;
}

function AssignmentList(props: ListProps) {
  const { list, setPage } = usePagedList<AdminAssignmentItem>('/admin/assessments/assignments', {
    ...props,
  });
  return (
    <ListFrame list={list} setPage={setPage} label="assignments" icon={<ClipboardList />}>
      {(items) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignment</TableHead>
              <TableHead>Lesson</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              <TableHead className="text-right">Awaiting grade</TableHead>
              <TableHead className="text-right">Graded</TableHead>
              <TableHead className="text-right">Released</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.assignmentId}>
                <TableCell>
                  <span className="grid">
                    <span className="font-medium">{a.title}</span>
                    <Link
                      href={`/admin/courses/${a.course.id}`}
                      className="type-caption text-muted-foreground hover:text-primary"
                    >
                      {a.course.title}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.lessonStatus} />
                </TableCell>
                <TableCell className="type-caption">
                  {a.dueAt ? formatDateTime(a.dueAt) : 'No due date'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.submissions}</TableCell>
                <TableCell className="text-right tabular-nums">{a.awaitingReview}</TableCell>
                <TableCell className="text-right tabular-nums">{a.graded}</TableCell>
                <TableCell className="text-right tabular-nums">{a.released}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListFrame>
  );
}

function QuizList(props: ListProps) {
  const { list, setPage } = usePagedList<AdminQuizItem>('/admin/assessments/quizzes', { ...props });
  return (
    <ListFrame
      list={list}
      setPage={setPage}
      label="quizzes"
      icon={<ClipboardList />}
      emptyText="Online quizzes appear here once faculty set them up on a quiz lesson."
    >
      {(items) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quiz</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Finalized attempts</TableHead>
              <TableHead className="text-right">Awaiting grade</TableHead>
              <TableHead>Results</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((quiz) => (
              <TableRow key={quiz.quizId}>
                <TableCell>
                  <span className="grid">
                    <span className="font-medium">{quiz.title}</span>
                    <Link
                      href={`/admin/courses/${quiz.course.id}`}
                      className="type-caption text-muted-foreground hover:text-primary"
                    >
                      {quiz.course.title}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={ASSESSMENT_BADGE[quiz.status].tone}>
                    {ASSESSMENT_BADGE[quiz.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{quiz.questionCount}</TableCell>
                <TableCell className="text-right tabular-nums">{quiz.finalizedAttempts}</TableCell>
                <TableCell className="text-right tabular-nums">{quiz.pendingEvaluation}</TableCell>
                <TableCell className="type-caption">
                  {quiz.resultsPublishedAt
                    ? `Published ${formatDate(quiz.resultsPublishedAt)}`
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListFrame>
  );
}

function ExamList(props: ListProps) {
  const { list, setPage } = usePagedList<AdminExamItem>('/admin/assessments/exams', { ...props });
  return (
    <ListFrame list={list} setPage={setPage} label="examinations" icon={<ClipboardList />}>
      {(items) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Examination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Window</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Finalized</TableHead>
              <TableHead className="text-right">Awaiting grade</TableHead>
              <TableHead>Results</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((exam) => (
              <TableRow key={exam.examId}>
                <TableCell>
                  <span className="grid">
                    <span className="font-medium">{exam.title}</span>
                    <Link
                      href={`/admin/courses/${exam.course.id}`}
                      className="type-caption text-muted-foreground hover:text-primary"
                    >
                      {exam.course.title}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={ASSESSMENT_BADGE[exam.status].tone}>
                    {ASSESSMENT_BADGE[exam.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="type-caption">
                  {formatDateTime(exam.opensAt)} – {formatDateTime(exam.closesAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{exam.questionCount}</TableCell>
                <TableCell className="text-right tabular-nums">{exam.finalizedAttempts}</TableCell>
                <TableCell className="text-right tabular-nums">{exam.pendingEvaluation}</TableCell>
                <TableCell className="type-caption">
                  {exam.resultsPublishedAt
                    ? `Published ${formatDate(exam.resultsPublishedAt)}`
                    : 'Not published'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListFrame>
  );
}

// --- Email delivery -------------------------------------------------------------------------

const DELIVERY_STATUS: Record<
  NotificationDeliveryStatus,
  { label: string; tone: 'success' | 'warning' | 'info' | 'destructive' | 'secondary' }
> = {
  PENDING: { label: 'Waiting', tone: 'info' },
  SENDING: { label: 'Sending', tone: 'info' },
  ACCEPTED: { label: 'Accepted by provider', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
  SKIPPED: { label: 'Not needed', tone: 'secondary' },
};

export function EmailDeliveriesAdmin() {
  const api = useAdminApi();
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const summary = useApiResource('/admin/notifications/deliveries/summary', () =>
    api.get<AdminNotificationSummaryDto>('/admin/notifications/deliveries/summary'),
  );
  const { list, setPage } = usePagedList<AdminNotificationDeliveryItem>(
    '/admin/notifications/deliveries',
    { q, status },
  );
  const count = (s: NotificationDeliveryStatus) =>
    summary.data
      ? formatCount(summary.data.byStatus.find((row) => row.status === s)?.count ?? 0)
      : undefined;
  return (
    <>
      <PageHeader
        title="Email delivery"
        description="Notification emails sent through Resend and their delivery state. Recipients also see every notification in the app."
        breadcrumbs={[overview, { label: 'Email delivery' }]}
      />
      {summary.error && !summary.data ? (
        <ErrorPanel message={errorMessage(summary.error)} onRetry={summary.reload} />
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Accepted by provider"
            value={count('ACCEPTED')}
            hint="Accepted by Resend — not proof the email reached the inbox"
          />
          <KpiCard
            title="Waiting / sending"
            value={
              summary.data
                ? formatCount(
                    (summary.data.byStatus.find((r) => r.status === 'PENDING')?.count ?? 0) +
                      (summary.data.byStatus.find((r) => r.status === 'SENDING')?.count ?? 0),
                  )
                : undefined
            }
            hint="Retried automatically with backoff"
          />
          <KpiCard
            title="Failed"
            value={count('FAILED')}
            hint="Permanent error or retries exhausted"
          />
          <KpiCard
            title="In-app notifications (7 days)"
            value={summary.data ? formatCount(summary.data.inAppLast7Days) : undefined}
          />
        </dl>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <SearchBox id="delivery-q" placeholder="Event, title or recipient" onSearch={setQ} />
        <FilterSelect
          id="delivery-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={(Object.keys(DELIVERY_STATUS) as NotificationDeliveryStatus[]).map((s) => ({
            value: s,
            label: DELIVERY_STATUS[s].label,
          }))}
        />
      </div>
      <ListFrame list={list} setPage={setPage} label="emails" icon={<Mail />}>
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="grid">
                      <span className="font-medium">{d.notification.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {d.notification.event}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{d.recipient.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={DELIVERY_STATUS[d.status].tone}>
                      {DELIVERY_STATUS[d.status].label}
                    </Badge>
                    {d.lastError ? (
                      <span className="mt-1 block type-caption text-muted-foreground">
                        {d.lastError}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.attempts}</TableCell>
                  <TableCell className="type-caption">{formatDateTime(d.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>
    </>
  );
}

// --- Roles & permissions --------------------------------------------------------------------

export function RolesAdmin() {
  const api = useAdminApi();
  const data = useApiResource('/admin/roles', () => api.get<AdminRolesDto>('/admin/roles'));
  if (data.error && !data.data)
    return <ErrorPanel message={errorMessage(data.error)} onRetry={data.reload} />;
  if (!data.data) return <LoadingPanel label="Loading roles…" />;
  const { roles, permissions } = data.data;
  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="What each role may do. Assign roles to a person from their account page."
        breadcrumbs={[overview, { label: 'Roles and permissions' }]}
      />
      <Alert tone="info" title="Role definitions are fixed for now">
        The roles below come from the platform’s access-control seed. Creating custom roles or
        changing what a role may do is pending the academy’s decision on admin types
        (CLIENT-CLARIFICATIONS S-01).
      </Alert>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {roles.map((role) => (
          <Section key={role.id} title={role.name} description={role.description ?? undefined}>
            <p className="type-body-sm">
              <span className="font-medium tabular-nums">{role.userCount}</span> account(s) ·{' '}
              {role.permissions.length} permission(s)
            </p>
          </Section>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} className="text-center">
                  {roleLabel(role.key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.key}>
                <TableCell>
                  <span className="grid">
                    <code className="type-caption">{permission.key}</code>
                    <span className="type-caption text-muted-foreground">
                      {permission.description}
                    </span>
                  </span>
                </TableCell>
                {roles.map((role) => {
                  const granted = role.permissions.includes(permission.key);
                  return (
                    <TableCell key={role.id} className="text-center">
                      {granted ? (
                        <ShieldCheck className="mx-auto size-4 text-success" aria-label="Granted" />
                      ) : (
                        <span className="text-muted-foreground" aria-label="Not granted">
                          —
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// --- Audit logs -----------------------------------------------------------------------------

const AUDIT_SOURCES: { value: AuditSource; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Administration',
    description:
      'Accounts, roles, course publication, faculty assignment, live classes and manual enrolments.',
  },
  {
    value: 'payment',
    label: 'Payments',
    description:
      'Orders, payments, refunds and reconciliation (including automatic events from Razorpay webhooks).',
  },
  {
    value: 'assessment',
    label: 'Assessments',
    description:
      'Publication, grading, grade revisions and result release of quizzes, exams and assignments.',
  },
];

export function AuditLogAdmin() {
  const [source, setSource] = React.useState<AuditSource>('admin');
  const [action, setAction] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const { list, setPage } = usePagedList<AdminAuditEntryDto>(
    '/admin/audit-logs',
    { source, action, from, to },
    50,
  );
  const meta = AUDIT_SOURCES.find((s) => s.value === source)!;
  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Append-only record of sensitive actions: who did what, to which record, and when."
        breadcrumbs={[overview, { label: 'Audit logs' }]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          id="audit-source"
          label="Log"
          value={source}
          onChange={(value) => setSource((value || 'admin') as AuditSource)}
          options={AUDIT_SOURCES.filter((s) => s.value !== 'admin').map(({ value, label }) => ({
            value,
            label,
          }))}
          allLabel="Administration"
        />
        <SearchBox
          id="audit-action"
          label="Action"
          placeholder='Action, e.g. "course." or "user.role_granted"'
          onSearch={setAction}
        />
        <Field id="audit-from" label="From">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="audit-to" label="To">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>
      <p className="type-caption text-muted-foreground">
        {meta.description} Actions before Phase 12 were not recorded in the administration log.
      </p>
      <ListFrame list={list} setPage={setPage} label="entries" icon={<History />}>
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="type-caption whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="grid">
                      <span className="font-medium">{auditActionLabel(entry.action)}</span>
                      <code className="type-caption text-muted-foreground">{entry.action}</code>
                    </span>
                  </TableCell>
                  <TableCell>
                    {entry.actor ? (
                      <Link
                        href={`/admin/users/${entry.actor.userId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {entry.actor.fullName}
                      </Link>
                    ) : (
                      'System'
                    )}
                  </TableCell>
                  <TableCell className="type-caption">
                    <EntityLink type={entry.entityType} id={entry.entityId} />
                  </TableCell>
                  <TableCell>
                    {entry.data ? (
                      <details>
                        <summary className="cursor-pointer type-caption text-primary">Show</summary>
                        <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>
    </>
  );
}

function EntityLink({ type, id }: { type: string; id: string }) {
  const href =
    type === 'user'
      ? `/admin/users/${id}`
      : type === 'course'
        ? `/admin/courses/${id}`
        : type === 'order'
          ? `/admin/payments/orders/${id}`
          : null;
  const label = `${type.replace(/_/g, ' ')} ${id.slice(0, 8)}…`;
  return href ? (
    <Link href={href} className="hover:text-primary hover:underline" title={id}>
      {label}
    </Link>
  ) : (
    <span title={id}>{label}</span>
  );
}
