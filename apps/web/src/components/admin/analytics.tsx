'use client';

import {
  PERMISSIONS,
  type CompletionAnalyticsDto,
  type EnrollmentAnalyticsDto,
  type ExamAnalyticsDto,
  type FacultyPerformanceRow,
  type PaginatedAnalytics,
  type PaymentMode,
  type PopularCourseRow,
  type RevenueAnalyticsDto,
  type StudentGrowthDto,
} from '@asra/types';
import Link from 'next/link';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  compareCounts,
  formatCount,
  formatPercent,
  presetRange,
  rangeQuery,
  type RangeFilter,
} from '@/lib/admin/analytics';
import { formatDate } from '@/lib/format';
import { formatAmount, MODE_LABEL, PAYMENT_STATUS } from '@/lib/payments';

import { DateRangeFilter, KpiCard, SearchBox, Section, SubNav } from './admin-kit';
import { ErrorPanel, LoadingPanel, SelectField, StatusBadge } from './admin-ui';
import { BarList, ColumnChart, TrendChart } from './charts';
import { errorMessage, hasPermission, useAdminApi, useApiResource } from './use-admin';

/**
 * Analytics (PHASE 12, docs/ADMIN-DASHBOARD.md §4). One page per report, sharing the date filter
 * (calendar days in IST) and the metric definitions printed under each report. The API computes
 * every figure; the browser only formats and plots it.
 */

const crumbs = [
  { label: 'Overview', href: '/admin' },
  { label: 'Analytics', href: '/admin/analytics' },
];

export function AnalyticsHeader({ title, description }: { title: string; description: string }) {
  const { user } = useAuth();
  const canRevenue = hasPermission(user, PERMISSIONS.PAYMENTS_VIEW);
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[...crumbs, { label: title }]}
      />
      <SubNav
        label="Analytics reports"
        items={[
          { href: '/admin/analytics', label: 'Student growth', exact: true },
          { href: '/admin/analytics/enrollments', label: 'Enrolments' },
          { href: '/admin/analytics/popular-courses', label: 'Popular courses' },
          ...(canRevenue ? [{ href: '/admin/analytics/revenue', label: 'Revenue' }] : []),
          { href: '/admin/analytics/completion', label: 'Completion' },
          { href: '/admin/analytics/exams', label: 'Exam performance' },
          { href: '/admin/analytics/faculty', label: 'Faculty activity' },
        ]}
      />
    </>
  );
}

/** "How this is calculated" — every report states its definitions next to its numbers. */
function Definitions({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <details className="rounded-xl border bg-card p-4 shadow-card">
      <summary className="cursor-pointer type-label text-heading">
        How these figures are calculated
      </summary>
      <dl className="mt-3 grid gap-2">
        {items.map(([term, text]) => (
          <div key={term} className="grid gap-0.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="type-label">{term}</dt>
            <dd className="type-body-sm text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function useReport<T>(path: string) {
  const api = useAdminApi();
  return useApiResource(path, () => api.get<T>(path));
}

function Loading<T>({
  report,
  children,
}: {
  report: ReturnType<typeof useReport<T>>;
  children: (data: T) => React.ReactNode;
}) {
  if (report.error && !report.data)
    return <ErrorPanel message={errorMessage(report.error)} onRetry={report.reload} />;
  if (!report.data) return <LoadingPanel label="Loading report…" rows={5} />;
  return (
    <div aria-busy={report.loading || undefined} className="grid gap-6">
      {children(report.data)}
    </div>
  );
}

const query = rangeQuery;

function usePage(filters: string) {
  const [state, setState] = React.useState({ filters, page: 1 });
  return [
    state.filters === filters ? state.page : 1,
    (page: number) => setState({ filters, page }),
  ] as const;
}

function Pager({
  pagination,
  setPage,
  label,
}: {
  pagination: { page: number; pageCount: number; total: number };
  setPage: (page: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="type-caption text-muted-foreground">
        {pagination.total} {label}
      </p>
      {pagination.pageCount > 1 ? (
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          onPageChange={setPage}
          label={`${label} pages`}
        />
      ) : null}
    </div>
  );
}

// --- Student growth -------------------------------------------------------------------------

export function StudentGrowthReport() {
  const [filter, setFilter] = React.useState<RangeFilter>(() => presetRange('30d'));
  const report = useReport<StudentGrowthDto>(`/admin/analytics/student-growth${query(filter)}`);
  return (
    <>
      <AnalyticsHeader title="Student growth" description="New student accounts over time." />
      <DateRangeFilter value={filter} onChange={setFilter} />
      <Loading report={report}>
        {(d) => (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                title="Registrations in period"

                value={formatCount(d.total)}
                delta={compareCounts(d.total, d.previousTotal, 'registrations')}
                deltaLabel={`vs ${formatDate(d.range.previousFrom)} – ${formatDate(d.range.previousTo)}`}
              />
              <KpiCard
                title="Student accounts (all time)"
                value={formatCount(d.allTime)}
                href="/admin/students"
              />
              <KpiCard
                title="Average per day"

                value={(d.total / dayCount(d.range.from, d.range.to)).toFixed(1)}
              />
            </dl>
            <Section title="Registrations">
              <TrendChart
                title="New student accounts"
                points={d.series}
                granularity={d.range.granularity}
                format={formatCount}
                emptyText="No students registered in this period."
              />
            </Section>
            <Definitions
              items={[
                ['Student', 'An account that holds the Student role, whatever its status.'],
                [
                  'Registration',
                  'The moment the account was created (users.created_at) — not the first enrolment or lesson.',
                ],
                [
                  'Previous period',
                  'The same number of days immediately before the selected range.',
                ],
              ]}
            />
          </>
        )}
      </Loading>
    </>
  );
}

function dayCount(from: string, to: string) {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

// --- Enrolments -----------------------------------------------------------------------------

const SOURCE_LABEL = {
  PAYMENT: 'Online payment',
  FREE: 'Free enrolment',
  ADMIN: 'Added by an administrator',
} as const;

export function EnrollmentsReport() {
  const [filter, setFilter] = React.useState<RangeFilter>(() => presetRange('30d'));
  const report = useReport<EnrollmentAnalyticsDto>(`/admin/analytics/enrollments${query(filter)}`);
  const breakdown = (rows: EnrollmentAnalyticsDto['byCourse'], link = false) =>
    rows.map((row) => ({
      key: row.id ?? row.label,
      label:
        link && row.id ? (
          <Link href={`/admin/courses/${row.id}`} className="hover:text-primary hover:underline">
            {row.label}
          </Link>
        ) : (
          row.label
        ),
      value: row.newEnrollments,
      note: `${row.stillActive} still active`,
    }));
  return (
    <>
      <AnalyticsHeader
        title="Enrolments"
        description="New enrolments over time and where they go."
      />
      <DateRangeFilter value={filter} onChange={setFilter} />
      <Loading report={report}>
        {(d) => (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                title="New enrolments in period"

                value={formatCount(d.total)}
                delta={compareCounts(d.total, d.previousTotal, 'enrolments')}
                deltaLabel="vs previous period"
              />
              <KpiCard
                title="Active enrolments now"
                value={formatCount(d.activeNow)}
                href="/admin/enrollments"
                hint="All courses, not limited to the period"
              />
              <KpiCard
                title="By source (period)"

                value={formatCount(d.bySource.find((s) => s.source === 'PAYMENT')?.count ?? 0)}
                hint={d.bySource.map((s) => `${SOURCE_LABEL[s.source]}: ${s.count}`).join(' · ')}
              />
            </dl>
            <Section title="New enrolments">
              <TrendChart
                title="New enrolments"
                points={d.series}
                granularity={d.range.granularity}
                format={formatCount}
                emptyText="No enrolments in this period."
              />
            </Section>
            <div className="grid gap-4 lg:grid-cols-3">
              <Section title="By course (top 10)">
                <BarList title="Courses" items={breakdown(d.byCourse, true)} format={formatCount} />
              </Section>
              <Section title="By class (top 10)">
                <BarList title="Classes" items={breakdown(d.byClass)} format={formatCount} />
              </Section>
              <Section title="By subject (top 10)">
                <BarList title="Subjects" items={breakdown(d.bySubject)} format={formatCount} />
              </Section>
            </div>
            <Definitions
              items={[
                [
                  'New enrolment',
                  'An enrolment whose latest activation (enrolled_at) falls in the period. Re-activating a cancelled enrolment reuses the same record, so each student and course is counted once, at its latest activation.',
                ],
                [
                  'Still active',
                  'Of those new enrolments, how many have not been cancelled since.',
                ],
                [
                  'Active now',
                  'Every enrolment that currently grants access, whenever it started.',
                ],
                [
                  'Class / subject',
                  'Taken from the course. Special courses without a class or subject are grouped separately.',
                ],
              ]}
            />
          </>
        )}
      </Loading>
    </>
  );
}

// --- Popular courses ------------------------------------------------------------------------

export function PopularCoursesReport() {
  const [filter, setFilter] = React.useState<RangeFilter>(() => presetRange('90d'));
  const [q, setQ] = React.useState('');
  const [page, setPage] = usePage(JSON.stringify([filter, q]));
  const report = useReport<PaginatedAnalytics<PopularCourseRow>>(
    `/admin/analytics/popular-courses${query({ ...filter, granularity: '' }, { q, page, pageSize: 20 })}`,
  );
  return (
    <>
      <AnalyticsHeader
        title="Popular courses"
        description="Courses ranked by new enrolments in the period."
      />
      <DateRangeFilter value={filter} onChange={setFilter} showGranularity={false} />
      <SearchBox id="popular-q" placeholder="Course title" onSearch={setQ} />
      <Loading report={report}>
        {(d) =>
          d.items.length === 0 ? (
            <Alert tone="info" title="No enrolments yet">
              Courses appear here once students are enrolled.
            </Alert>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">New in period</TableHead>
                      <TableHead className="text-right">Active now</TableHead>
                      <TableHead className="text-right">All enrolments</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((row) => (
                      <TableRow key={row.course.id}>
                        <TableCell className="tabular-nums">{row.rank}</TableCell>
                        <TableCell>
                          <span className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/courses/${row.course.id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {row.course.title}
                            </Link>
                            {row.course.status !== 'PUBLISHED' ? (
                              <StatusBadge status={row.course.status} />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.newEnrollments)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.activeEnrollments)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.totalEnrollments)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.completedEnrollments)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(row.completionPercent)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager pagination={d.pagination} setPage={setPage} label="courses" />
            </>
          )
        }
      </Loading>
      <Definitions
        items={[
          [
            'Ranking',
            'New enrolments in the period (latest activation), then active enrolments now, then title. Only courses with at least one enrolment are listed. Revenue is not used.',
          ],
          [
            'Active now / all enrolments',
            'All time: enrolments currently granting access, and every enrolment record including cancelled ones. Failed or abandoned payments never create an enrolment.',
          ],
          ['Completion', 'Active enrolments marked complete ÷ active enrolments.'],
        ]}
      />
    </>
  );
}

// --- Revenue --------------------------------------------------------------------------------

export function RevenueReport() {
  const [filter, setFilter] = React.useState<RangeFilter>(() => presetRange('90d'));
  const [mode, setMode] = React.useState<PaymentMode | ''>('');
  const report = useReport<RevenueAnalyticsDto>(
    `/admin/analytics/revenue${query(filter, { mode })}`,
  );
  return (
    <>
      <AnalyticsHeader
        title="Revenue"
        description="Money collected through verified Razorpay payments."
      />
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <DateRangeFilter value={filter} onChange={setFilter} />
        </div>
        <div className="w-52 rounded-xl border bg-card p-4 shadow-card">
          <SelectField
            id="revenue-mode"
            label="Payment mode"
            value={mode || report.data?.mode || 'LIVE'}
            onValueChange={(value) => setMode(value as PaymentMode)}
            options={[
              { value: 'LIVE', label: MODE_LABEL.LIVE },
              { value: 'TEST', label: MODE_LABEL.TEST },
            ]}
          />
        </div>
      </div>
      <Loading report={report}>
        {(d) => (
          <>
            {d.mode === 'TEST' ? (
              <Badge variant="warning">Test transactions — not real revenue</Badge>
            ) : null}
            {(d.totals.length
              ? d.totals
              : [
                  {
                    currency: 'INR',
                    grossCapturedMinor: 0,
                    refundedMinor: 0,
                    netMinor: 0,
                    capturedPaymentCount: 0,
                  },
                ]
            ).map((t) => {
              const prev = d.previousTotals.find((p) => p.currency === t.currency);
              return (
                <dl key={t.currency} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    title="Gross collected"
                    value={formatAmount(t.grossCapturedMinor, t.currency)}
                    hint={`${t.capturedPaymentCount} captured payment(s)`}
                  />
                  <KpiCard
                    title="Refunded"
                    value={formatAmount(t.refundedMinor, t.currency)}
                    hint="Refunds processed by Razorpay in the period"
                  />
                  <KpiCard
                    title="Net collected"

                    value={formatAmount(t.netMinor, t.currency)}
                    hint={`Previous period: ${formatAmount(prev?.netMinor ?? 0, t.currency)}`}
                  />
                  <KpiCard
                    title="Failed / awaiting"

                    value={`${d.failedPayments} / ${d.pendingOrders}`}
                    hint="Failed payment attempts / unpaid open orders created in the period"
                    href="/admin/payments"
                  />
                </dl>
              );
            })}
            {d.series.length === 0 ? (
              <Section title="Net collected over time">
                <p className="type-body-sm text-muted-foreground">
                  No captured payments or refunds in this period.
                </p>
              </Section>
            ) : (
              d.series.map((s) => (
                <Section key={s.currency} title={`Net collected over time (${s.currency})`}>
                  <TrendChart
                    title="Net collected (gross − refunds)"
                    points={s.points.map((p) => ({ period: p.period, value: p.netMinor }))}
                    granularity={d.range.granularity}
                    format={(v) => formatAmount(v, s.currency)}
                  />
                </Section>
              ))
            )}
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <Section title="By course (top 20, by net)">
                {d.byCourse.length === 0 ? (
                  <p className="type-body-sm text-muted-foreground">
                    No course revenue in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Refunded</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Payments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.byCourse.map((row) => (
                          <TableRow key={`${row.course.id}-${row.currency}`}>
                            <TableCell>
                              <Link
                                href={`/admin/courses/${row.course.id}`}
                                className="hover:text-primary hover:underline"
                              >
                                {row.course.title}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatAmount(row.grossMinor, row.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatAmount(row.refundedMinor, row.currency)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatAmount(row.netMinor, row.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.capturedPayments}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Section>
              <Section
                title="Payment attempts by status"
                description="Attempts started in the period, by their current status."
              >
                <BarList
                  title="Status"
                  items={d.paymentStatus.map((s) => ({
                    key: s.status,
                    label: PAYMENT_STATUS[s.status].label,
                    value: s.count,
                  }))}
                  format={formatCount}
                  emptyText="No payment attempts in this period."
                />
              </Section>
            </div>
            <Definitions
              items={[
                [
                  'Gross collected',
                  'Sum of payments Razorpay CAPTURED in the period (by capture time). Each provider payment is stored once, so duplicate webhooks or reconciliations cannot count it twice. Orders, checkout redirects and authorised-but-uncaptured or failed attempts are never revenue.',
                ],
                [
                  'Refunded',
                  'Sum of refunds PROCESSED by Razorpay in the period (by processing time), including partial refunds. Requested or pending refunds are not subtracted until processed.',
                ],
                [
                  'Net collected',
                  'Gross − refunded. Before Razorpay fees and taxes, which the platform does not receive. Not a GST or accounting figure (AD-05).',
                ],
                ['By course', 'Payments and refunds attributed to the course of their order.'],
                [
                  'Payment mode',
                  'Test and live transactions are never mixed. The default is the active checkout mode, or Live.',
                ],
                ['Money', 'Exact integer paise summed by the database — no rounding.'],
              ]}
            />
          </>
        )}
      </Loading>
    </>
  );
}

// --- Completion -----------------------------------------------------------------------------

export function CompletionReport() {
  const [filter, setFilter] = React.useState<RangeFilter>({ from: '', to: '', granularity: '' });
  const [q, setQ] = React.useState('');
  const [page, setPage] = usePage(JSON.stringify([filter, q]));
  const report = useReport<CompletionAnalyticsDto>(
    `/admin/analytics/completion${query({ ...filter, granularity: '' }, { q, page })}`,
  );
  return (
    <>
      <AnalyticsHeader
        title="Course completion"
        description="How many enrolled students have completed their course."
      />
      <DateRangeFilter value={filter} onChange={setFilter} allowAllTime showGranularity={false} />
      <SearchBox id="completion-q" placeholder="Course title" onSearch={setQ} />
      <Loading report={report}>
        {(d) => (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                title="Eligible (active enrolments)"
                value={formatCount(d.overall.eligible)}
                hint={d.range ? 'Enrolled in the selected period' : 'All time'}
              />
              <KpiCard title="Completed" value={formatCount(d.overall.completed)} />
              <KpiCard title="Completion rate" value={formatPercent(d.overall.completionPercent)} />
            </dl>
            {d.items.length === 0 ? (
              <Alert tone="info" title="No active enrolments">
                Completion appears once students are enrolled.
              </Alert>
            ) : (
              <Section title="By course" description="Largest courses first.">
                <BarList
                  title="Completion rate by course"
                  items={d.items.map((row) => ({
                    key: row.course.id,
                    label: (
                      <Link
                        href={`/admin/courses/${row.course.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {row.course.title}
                      </Link>
                    ),
                    value: row.completionPercent ?? 0,
                    note: `${row.completed} of ${row.eligible}`,
                  }))}
                  format={(v) => `${v}%`}
                />
                <Pager pagination={d.pagination} setPage={setPage} label="courses" />
              </Section>
            )}
            <Definitions
              items={[
                [
                  'Eligible (denominator)',
                  'Enrolments that currently grant access (ACTIVE). Cancelled enrolments and students who were never enrolled are excluded. With a period selected, only enrolments activated in that period (a cohort).',
                ],
                [
                  'Completed (numerator)',
                  'Eligible enrolments the LMS marked complete — the first time every counted lesson was completed (docs/STUDENT-LMS.md §4). Watching videos alone does not complete a course.',
                ],
                [
                  'Pending rules',
                  'Quiz/exam results and attendance do not affect completion (AA-04, AC-15 pending).',
                ],
              ]}
            />
          </>
        )}
      </Loading>
    </>
  );
}

// --- Exams ----------------------------------------------------------------------------------

export function ExamsReport() {
  const [filter, setFilter] = React.useState<RangeFilter>({ from: '', to: '', granularity: '' });
  const [q, setQ] = React.useState('');
  const [page, setPage] = usePage(JSON.stringify([filter, q]));
  const report = useReport<ExamAnalyticsDto>(
    `/admin/analytics/exams${query({ ...filter, granularity: '' }, { q, page })}`,
  );
  return (
    <>
      <AnalyticsHeader
        title="Exam performance"
        description="Results of finalized examination attempts."
      />
      <DateRangeFilter value={filter} onChange={setFilter} allowAllTime showGranularity={false} />
      <SearchBox id="exam-q" placeholder="Examination title" onSearch={setQ} />
      <Loading report={report}>
        {(d) => (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Finalized attempts"
                value={formatCount(d.overall.finalizedAttempts)}
                hint={`${d.overall.distinctStudents} student(s)`}
              />
              <KpiCard
                title="Awaiting manual grading"
                value={formatCount(d.overall.pendingEvaluation)}
                hint="Not counted in scores"
                href="/admin/assessments/exams"
              />
              <KpiCard
                title="Average score"
                value={formatPercent(d.overall.averagePercent, 1)}
                hint={`${d.overall.evaluatedAttempts} evaluated attempt(s)`}
              />
              <KpiCard
                title="Pass rate"
                value={formatPercent(d.overall.passPercent)}
                hint={`${d.overall.passedAttempts} passed`}
              />
            </dl>
            <Section
              title="Score distribution"
              description="Evaluated attempts by percentage band."
            >
              <ColumnChart
                title="Attempts per score band"
                columns={d.distribution.map((b) => ({
                  key: String(b.from),
                  label: b.from === 90 ? '90–100' : `${b.from}–${b.from + 9}`,
                  value: b.count,
                }))}
              />
            </Section>
            {d.items.length === 0 ? (
              <Alert tone="info" title="No examinations">
                Published examinations appear here.
              </Alert>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Examination</TableHead>
                        <TableHead>Window</TableHead>
                        <TableHead className="text-right">Finalized</TableHead>
                        <TableHead className="text-right">Pending grading</TableHead>
                        <TableHead className="text-right">Average</TableHead>
                        <TableHead className="text-right">Pass rate</TableHead>
                        <TableHead>Results</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.items.map((row) => (
                        <TableRow key={row.exam.id}>
                          <TableCell>
                            <span className="grid">
                              <span className="font-medium">{row.exam.title}</span>
                              <span className="type-caption text-muted-foreground">
                                {row.course.title}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="type-caption">
                            {formatDate(row.opensAt)} – {formatDate(row.closesAt)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.finalizedAttempts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.pendingEvaluation}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.averagePercent, 1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.passPercent)}
                          </TableCell>
                          <TableCell>
                            {row.resultsPublishedAt ? (
                              <Badge variant="success">Published</Badge>
                            ) : (
                              <Badge variant="secondary">Not published</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pager pagination={d.pagination} setPage={setPage} label="examinations" />
              </>
            )}
            <Definitions
              items={[
                [
                  'Finalized attempt',
                  'Submitted by the student, or closed by the server at its deadline. Attempts in progress are excluded. With a period selected: attempts submitted in that period.',
                ],
                [
                  'Pending grading',
                  'Finalized attempts with written answers faculty have not graded yet. They are never counted as zero.',
                ],
                [
                  'Average / pass rate',
                  'Over evaluated attempts only, using the scores stored by the assessment engine (negative marking and the exam’s pass mark already applied).',
                ],
                [
                  'Several attempts',
                  'Every attempt counts on its own; no single "final" mark is derived (AC-01 pending).',
                ],
                ['Draft examinations', 'Excluded.'],
              ]}
            />
          </>
        )}
      </Loading>
    </>
  );
}

// --- Faculty --------------------------------------------------------------------------------

export function FacultyReport() {
  const [filter, setFilter] = React.useState<RangeFilter>(() => presetRange('30d'));
  const [q, setQ] = React.useState('');
  const [page, setPage] = usePage(JSON.stringify([filter, q]));
  const report = useReport<PaginatedAnalytics<FacultyPerformanceRow>>(
    `/admin/analytics/faculty${query({ ...filter, granularity: '' }, { q, page })}`,
  );
  return (
    <>
      <AnalyticsHeader
        title="Faculty activity"
        description="Recorded teaching activity and backlog per faculty member."
      />
      <Alert tone="info" title="Operational indicators, not ratings">
        These are counts of recorded work. They do not measure teaching quality and are not a
        ranking.
      </Alert>
      <DateRangeFilter value={filter} onChange={setFilter} showGranularity={false} />
      <SearchBox id="faculty-q" placeholder="Faculty name" onSearch={setQ} />
      <Loading report={report}>
        {(d) =>
          d.items.length === 0 ? (
            <Alert tone="info" title="No faculty accounts">
              Faculty appear here once they have an account.
            </Alert>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faculty</TableHead>
                      <TableHead className="text-right">Courses</TableHead>
                      <TableHead className="text-right">Active students</TableHead>
                      <TableHead className="text-right">Classes held</TableHead>
                      <TableHead className="text-right">Classes cancelled</TableHead>
                      <TableHead className="text-right">Graded</TableHead>
                      <TableHead className="text-right">Median grading time</TableHead>
                      <TableHead className="text-right">Awaiting grade</TableHead>
                      <TableHead className="text-right">Course completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((row) => (
                      <TableRow key={row.faculty.facultyProfileId}>
                        <TableCell>
                          <Link
                            href={`/admin/users/${row.faculty.userId}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {row.faculty.fullName}
                          </Link>
                          {row.faculty.status !== 'ACTIVE' ? (
                            <Badge variant="warning" className="ml-2">
                              {row.faculty.status.toLowerCase()}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.assignedCourses}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.activeStudents}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.liveClassesCompleted}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.liveClassesCancelled}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.submissionsGraded}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.medianGradingHours === null ? '—' : `${row.medianGradingHours} h`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.pendingSubmissions + row.pendingAttemptGrading}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(row.completionPercent)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager pagination={d.pagination} setPage={setPage} label="faculty" />
            </>
          )
        }
      </Loading>
      <Definitions
        items={[
          [
            'Courses / active students',
            'Current course assignments, and distinct students with an active enrolment in them (now).',
          ],
          [
            'Classes held / cancelled',
            'Live classes hosted by the faculty member that started in the period and were marked completed, or were cancelled.',
          ],
          [
            'Graded / median grading time',
            'Assignment submissions this faculty member graded in the period, and the median time from the current version’s submission to its latest grade.',
          ],
          [
            'Awaiting grade',
            'Now: submissions and written exam/quiz answers waiting for a grade in the assigned courses.',
          ],
          [
            'Course completion',
            'Active enrolments marked complete ÷ active enrolments, across the assigned courses (now).',
          ],
        ]}
      />
    </>
  );
}
