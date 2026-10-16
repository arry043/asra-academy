'use client';

import type { FacultyCourseCard, FacultyDashboardDto, Paginated } from '@asra/types';
import {
  BookOpen,
  CalendarClock,
  FileQuestion,
  FolderTree,
  Inbox,
  MonitorPlay,
  NotebookPen,
  Send,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { CourseThumb } from '@/components/student/student-ui';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/input';
import { formatDate, formatDateTime } from '@/lib/format';
import { facultyCourseHref } from '@/lib/faculty/portal';
import { courseEyebrow } from '@/lib/student/learning';

import {
  ClassBadge,
  ErrorPanel,
  LateBadge,
  LoadingPanel,
  ReviewBadge,
  Stat,
  StatusBadge,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };

/**
 * Faculty dashboard (PHASE 08): one aggregated request. Every figure is computed by the API from
 * the faculty member's own assigned courses; nothing is a sample or placeholder value.
 */
export function FacultyDashboard() {
  const api = useFacultyApi();
  const dashboard = useApiResource('/faculty/dashboard', () =>
    api.get<FacultyDashboardDto>('/faculty/dashboard'),
  );

  if (dashboard.error && !dashboard.data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorPanel message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
      </>
    );
  }
  if (!dashboard.data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingPanel label="Loading your dashboard…" rows={5} />
      </>
    );
  }

  const data = dashboard.data;
  const firstName = data.faculty.fullName.split(' ')[0] ?? data.faculty.fullName;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={data.faculty.designation ?? 'Your courses, students and reviews at a glance.'}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned courses" value={data.stats.courses} icon={<BookOpen />} />
        <Stat label="Enrolled students" value={data.stats.activeStudents} icon={<Users />} />
        <Stat
          label="Awaiting review"
          value={data.stats.pendingReviews}
          icon={<Inbox />}
          hint={
            data.stats.gradedUnreleased > 0
              ? `${data.stats.gradedUnreleased} graded, not released`
              : undefined
          }
        />
        <Stat
          label="Upcoming classes"
          value={data.stats.upcomingClasses}
          icon={<CalendarClock />}
        />
      </section>

      <section aria-labelledby="courses-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="courses-heading" className="type-h2 text-heading">
            Assigned courses
          </h2>
          {data.stats.courses > data.courses.length ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/faculty/courses">All {data.stats.courses} courses</Link>
            </Button>
          ) : null}
        </div>
        {data.courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title="No courses assigned yet"
            description="An administrator assigns faculty to courses. Once you are assigned, the course and its students appear here."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <li key={course.id}>
                <FacultyCourseTile course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="reviews-heading" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="reviews-heading" className="type-h2 text-heading">
              Waiting for review
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/faculty/submissions">All submissions</Link>
            </Button>
          </div>
          {data.pendingSubmissions.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-5 type-body-sm text-muted-foreground">
              No submissions are waiting for review.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.pendingSubmissions.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/faculty/submissions/${item.id}`}
                    className="grid gap-1 rounded-xl border bg-card p-4 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="type-label text-heading">
                      {item.student.fullName} · {item.assignment.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground">
                      {item.course.title} · submitted {formatDateTime(item.submittedAt)}
                      <ReviewBadge item={item} />
                      {item.late ? <LateBadge /> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="classes-heading" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="classes-heading" className="type-h2 text-heading">
              Upcoming live classes
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/faculty/classes">Schedule or manage</Link>
            </Button>
          </div>
          {data.upcomingClasses.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-5 type-body-sm text-muted-foreground">
              No classes scheduled.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.upcomingClasses.map((item) => (
                <li key={item.id} className="grid gap-1 rounded-xl border bg-card p-4">
                  <span className="type-label text-heading">{item.title}</span>
                  <span className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground">
                    {item.course.title} · {formatDateTime(item.startsAt)} IST ·{' '}
                    {item.durationMinutes} min
                    <ClassBadge item={item} />
                    {item.joinUrl ? null : <Badge variant="secondary">No meeting link</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.features.liveClassProvider.available ? null : (
            <p className="type-caption text-muted-foreground">
              {data.features.liveClassProvider.message}
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="shortcuts-heading" className="grid gap-3">
        <h2 id="shortcuts-heading" className="type-h2 text-heading">
          Teaching tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Shortcut href="/faculty/content" icon={<FolderTree />} title="Content">
            Modules, chapters, lessons and resource links.
          </Shortcut>
          <Shortcut href="/faculty/assignments" icon={<NotebookPen />} title="Assignments">
            {data.stats.assignments} assignment lesson{data.stats.assignments === 1 ? '' : 's'}.
          </Shortcut>
          <Shortcut href="/faculty/quizzes" icon={<FileQuestion />} title="Quizzes">
            {data.stats.quizLessons} quiz lesson{data.stats.quizLessons === 1 ? '' : 's'}{' '}
            (instructions only).
          </Shortcut>
          <Shortcut href="/faculty/performance" icon={<Send />} title="Performance">
            Progress, submissions and released results.
          </Shortcut>
        </ul>
        {data.features.fileUploads.available ? null : (
          <Alert tone="info" title="File uploads">
            <p>{data.features.fileUploads.message}</p>
          </Alert>
        )}
      </section>
    </>
  );
}

function Shortcut({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full gap-3 rounded-xl border bg-card p-4 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-4"
        >
          {icon}
        </span>
        <span className="grid gap-0.5">
          <span className="type-label text-heading">{title}</span>
          <span className="type-caption text-muted-foreground">{children}</span>
        </span>
      </Link>
    </li>
  );
}

/** An assigned course with real counts and links into its workspace. */
export function FacultyCourseTile({
  course,
  mode = 'course',
}: {
  course: FacultyCourseCard;
  mode?: 'course' | 'content';
}) {
  const eyebrow = courseEyebrow(course);
  return (
    <Card className="h-full gap-4 overflow-hidden pt-0 sm:pt-0">
      <CourseThumb course={course} />
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={course.status} />
          {course.isPrimary ? <Badge variant="accent">Primary faculty</Badge> : null}
        </div>
        {eyebrow ? <p className="type-caption text-muted-foreground">{eyebrow}</p> : null}
        <CardTitle as="h3" className="line-clamp-2">
          <Link
            href={facultyCourseHref(course.id, mode === 'content' ? 'curriculum' : undefined)}
            className="rounded-sm hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {course.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-auto">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 type-body-sm">
          <dt className="text-muted-foreground">Students</dt>
          <dd className="text-right tabular-nums">{course.activeStudents}</dd>
          <dt className="text-muted-foreground">Lessons</dt>
          <dd className="text-right tabular-nums">
            {course.lessons.published} published
            {course.lessons.draft > 0 ? ` · ${course.lessons.draft} draft` : ''}
          </dd>
          <dt className="text-muted-foreground">Assignments</dt>
          <dd className="text-right tabular-nums">{course.assignments}</dd>
          <dt className="text-muted-foreground">To review</dt>
          <dd className="text-right tabular-nums">{course.pendingReviews}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="text-right">{formatDate(course.updatedAt)}</dd>
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {mode === 'content' ? (
          <Button asChild size="sm">
            <Link href={facultyCourseHref(course.id, 'curriculum')}>Manage curriculum</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="sm">
              <Link href={facultyCourseHref(course.id)}>Open workspace</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={facultyCourseHref(course.id, 'curriculum')}>Curriculum</Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

/** `/faculty/courses` and `/faculty/content`: the assigned courses, searchable and paginated. */
export function FacultyCoursesPage({ mode }: { mode: 'course' | 'content' }) {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState('');
  const path = withQuery('/faculty/courses', { page, pageSize: 12, q: q.trim() });
  const list = useApiResource(path, () => api.get<Paginated<FacultyCourseCard>>(path));
  const content = mode === 'content';

  return (
    <>
      <PageHeader
        title={content ? 'Content' : 'My courses'}
        breadcrumbs={[home, { label: content ? 'Content' : 'My courses' }]}
        description={
          content
            ? 'Choose a course to organise its modules, chapters, lessons and resources. Course publication stays with the academy administrators.'
            : 'Courses an administrator has assigned to you.'
        }
      />
      <div className="max-w-sm">
        <SearchInput
          aria-label="Search courses"
          placeholder="Search by title or subject"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading courses…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<MonitorPlay />}
          title={q ? 'No matching courses' : 'No courses assigned yet'}
          description={
            q
              ? 'Try a different search.'
              : 'An administrator assigns faculty to courses. Assigned courses appear here.'
          }
        />
      ) : (
        <div className="grid gap-6" aria-busy={list.loading || undefined}>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((course) => (
              <li key={course.id}>
                <FacultyCourseTile course={course} mode={mode} />
              </li>
            ))}
          </ul>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Courses pages"
            />
          ) : null}
        </div>
      )}
    </>
  );
}
