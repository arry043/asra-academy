'use client';

import type {
  CoursePerformanceDto,
  FacultyStudentRow,
  Paginated,
  ProgressDistribution,
} from '@asra/types';
import { BarChart3, Users } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { SearchInput } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/format';
import { percentLabel } from '@/lib/faculty/portal';
import { progressDetail } from '@/lib/student/learning';

import {
  CourseFilter,
  ErrorPanel,
  LoadingPanel,
  Stat,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };

/**
 * Students enrolled (ACTIVE) in the faculty member's courses: teaching data only — name, class,
 * progress, assignment work. No email, phone or payment data is requested or shown (C-04).
 */
export function StudentsTable({ courseId }: { courseId?: string }) {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const course = courseId ?? filter;
  const path = withQuery('/faculty/students', {
    page,
    pageSize: 20,
    q: q.trim(),
    courseId: course,
  });
  const list = useApiResource(path, () => api.get<Paginated<FacultyStudentRow>>(path));

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <SearchInput
          aria-label="Search students by name"
          placeholder="Search by name"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        {courseId ? null : (
          <CourseFilter
            id="students-course"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          />
        )}
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading students…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q ? 'No matching students' : 'No enrolled students yet'}
          description="Students appear here once they are enrolled in your courses."
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Enrolled students">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                {courseId ? null : <TableHead>Course</TableHead>}
                <TableHead>Progress</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((row) => (
                <TableRow key={row.enrollmentId}>
                  <TableCell>
                    <span className="grid">
                      <span className="font-medium text-heading">{row.student.fullName}</span>
                      <span className="type-caption text-muted-foreground">
                        {[row.student.class?.name, row.student.stream?.name]
                          .filter(Boolean)
                          .join(' · ') || 'No class recorded'}
                      </span>
                    </span>
                  </TableCell>
                  {courseId ? null : <TableCell>{row.course.title}</TableCell>}
                  <TableCell className="min-w-44">
                    <Progress
                      value={row.progress.percent}
                      label={`${row.student.fullName} progress`}
                      size="sm"
                    />
                    <span className="type-caption text-muted-foreground">
                      {progressDetail(row.progress)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="grid type-body-sm">
                      <span>
                        {row.work.submitted} of {row.work.assignments} submitted
                      </span>
                      <span className="type-caption text-muted-foreground">
                        {row.work.graded} graded · {row.work.released} released
                        {row.work.releasedScorePercent === null
                          ? ''
                          : ` · score ${row.work.releasedScorePercent}%`}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(row.lastActivityAt) ?? (
                      <span className="text-muted-foreground">
                        Not started · enrolled {formatDate(row.enrolledAt)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Student pages"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function StudentsPage() {
  return (
    <>
      <PageHeader
        title="Students"
        breadcrumbs={[home, { label: 'Students' }]}
        description="Students enrolled in your courses, with their learning progress and assignment work."
      />
      <StudentsTable />
    </>
  );
}

const BUCKETS: { key: keyof ProgressDistribution; label: string }[] = [
  { key: '0', label: 'Not started (0%)' },
  { key: '1-24', label: '1–24%' },
  { key: '25-49', label: '25–49%' },
  { key: '50-74', label: '50–74%' },
  { key: '75-99', label: '75–99%' },
  { key: '100', label: 'Completed (100%)' },
];

/** Course metrics computed by the API (definitions in docs/FACULTY-PORTAL.md §7). */
export function PerformancePanel({ courseId }: { courseId: string }) {
  const api = useFacultyApi();
  const path = `/faculty/courses/${courseId}/performance`;
  const perf = useApiResource(path, () => api.get<CoursePerformanceDto>(path));

  if (perf.error && !perf.data) {
    return <ErrorPanel message={errorMessage(perf.error)} onRetry={perf.reload} />;
  }
  if (!perf.data) return <LoadingPanel label="Loading performance…" />;
  const m = perf.data.metrics;

  return (
    <div className="grid gap-6">
      <section aria-label="Course metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enrolled students" value={m.activeStudents} icon={<Users />} />
        <Stat
          label="Average progress"
          value={percentLabel(m.averageProgressPercent)}
          icon={<BarChart3 />}
          hint={`${m.countableLessons} countable lesson${m.countableLessons === 1 ? '' : 's'}`}
        />
        <Stat
          label="Assignment submission rate"
          value={percentLabel(m.submissionRatePercent)}
          icon={<BarChart3 />}
          hint={`${m.submissions} of ${m.publishedAssignments * m.activeStudents} possible`}
        />
        <Stat
          label="Released score"
          value={percentLabel(m.releasedScorePercent)}
          icon={<BarChart3 />}
          hint={`${m.released} result${m.released === 1 ? '' : 's'} released`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="distribution-heading" className="grid content-start gap-3">
          <h3 id="distribution-heading" className="type-h3 text-heading">
            Progress distribution
          </h3>
          {m.activeStudents === 0 ? (
            <p className="type-body-sm text-muted-foreground">No enrolled students yet.</p>
          ) : m.countableLessons === 0 ? (
            <p className="type-body-sm text-muted-foreground">
              This course has no published lessons that count towards progress yet.
            </p>
          ) : (
            <Table scrollLabel="Progress distribution">
              <TableHeader>
                <TableRow>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BUCKETS.map((bucket) => (
                  <TableRow key={bucket.key}>
                    <TableCell>{bucket.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.distribution[bucket.key]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        <section aria-labelledby="activity-heading" className="grid content-start gap-3">
          <h3 id="activity-heading" className="type-h3 text-heading">
            Activity and reviews
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-xl border bg-card p-5 type-body-sm">
            <dt className="text-muted-foreground">Completed the course</dt>
            <dd className="tabular-nums">{m.completedStudents}</dd>
            <dt className="text-muted-foreground">Active in the last 7 days</dt>
            <dd className="tabular-nums">{m.activeLast7Days}</dd>
            <dt className="text-muted-foreground">Published assignments</dt>
            <dd className="tabular-nums">{m.publishedAssignments}</dd>
            <dt className="text-muted-foreground">Awaiting review</dt>
            <dd className="tabular-nums">{m.pendingReviews}</dd>
            <dt className="text-muted-foreground">Graded, not released</dt>
            <dd className="tabular-nums">{m.gradedUnreleased}</dd>
          </dl>
          <p className="type-caption text-muted-foreground">
            Progress counts published video, PDF, document, link and text lessons marked complete by
            the student. Quiz and exam results are not available yet.
          </p>
        </section>
      </div>

      <section aria-labelledby="per-student-heading" className="grid gap-3">
        <h3 id="per-student-heading" className="type-h3 text-heading">
          Students
        </h3>
        <StudentsTable courseId={courseId} />
      </section>
    </div>
  );
}

export function PerformancePage() {
  const [courseId, setCourseId] = React.useState('');
  return (
    <>
      <PageHeader
        title="Performance"
        breadcrumbs={[home, { label: 'Performance' }]}
        description="Learning progress and assignment results of the students in one of your courses."
      />
      <div className="max-w-md">
        <CourseFilter
          id="performance-course"
          value={courseId}
          onChange={setCourseId}
          allLabel={null}
        />
      </div>
      {courseId ? (
        <PerformancePanel key={courseId} courseId={courseId} />
      ) : (
        <EmptyState
          icon={<BarChart3 />}
          title="Choose a course"
          description="Pick one of your assigned courses to see its metrics."
        />
      )}
    </>
  );
}
