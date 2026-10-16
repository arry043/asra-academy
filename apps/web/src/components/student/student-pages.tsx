'use client';

import type {
  LearningHistoryItem,
  LessonContentType,
  Paginated,
  StudentCourseCard,
  StudentEnrollmentRecord,
  StudentFeatures,
  StudentLessonListItem,
} from '@asra/types';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileQuestion,
  GraduationCap,
  History,
  MonitorPlay,
  NotebookPen,
  PlayCircle,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/format';
import { courseHref, formatClock, LESSON_TYPE_LABELS, learnHref } from '@/lib/student/learning';

import {
  CourseProgress,
  ErrorPanel,
  FeatureUnavailable,
  ListPager,
  LoadingPanel,
} from './student-ui';
import { errorMessage, useApiResource, useStudentApi, withPage } from './use-student';

const home = { label: 'Dashboard', href: '/student/dashboard' };

function useFeatures() {
  const api = useStudentApi();
  return useApiResource('/student/features', () => api.get<StudentFeatures>('/student/features'));
}

/** Loads a paginated student list and renders loading/error/empty states around it. */
function PagedList<T>({
  path,
  extra,
  label,
  empty,
  children,
}: {
  path: string;
  extra?: Record<string, string>;
  label: string;
  empty: React.ReactNode;
  children: (items: T[]) => React.ReactNode;
}) {
  const api = useStudentApi();
  const [page, setPage] = React.useState(1);
  const url = withPage(path, page, extra);
  const list = useApiResource(url, () => api.get<Paginated<T>>(url));
  if (list.error && !list.data) {
    return <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />;
  }
  if (!list.data) return <LoadingPanel label={`Loading ${label}…`} />;
  if (list.data.items.length === 0) return <>{empty}</>;
  return (
    <div className="grid gap-6">
      {children(list.data.items)}
      <ListPager
        pagination={list.data.pagination}
        onPageChange={setPage}
        label={`${label} pages`}
      />
    </div>
  );
}

/** Lessons of one kind across enrolled courses, grouped by course in curriculum order. */
function LessonItems({ items }: { items: StudentLessonListItem[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => {
        const clock = formatClock(item.durationSeconds);
        return (
          <li key={item.lesson.lessonId}>
            <Card className="gap-3 sm:flex-row sm:items-center">
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="type-caption text-muted-foreground">
                  {item.course.title} · {item.lesson.moduleTitle} › {item.lesson.chapterTitle}
                </span>
                <h2 className="type-h4 break-words text-heading">{item.lesson.lessonTitle}</h2>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{LESSON_TYPE_LABELS[item.lesson.contentType]}</Badge>
                  {clock ? <Badge variant="secondary">{clock}</Badge> : null}
                  {item.completedAt ? (
                    <Badge variant="success">
                      <CheckCircle2 aria-hidden /> Completed
                    </Badge>
                  ) : null}
                </span>
              </div>
              <Button asChild size="sm" variant="outline" className="self-start sm:self-center">
                <Link href={learnHref(item.course.id, item.lesson.lessonId)}>Open lesson</Link>
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** Quizzes / assignments: real placeholder lessons + an honest note about the missing engine. */
export function AssessmentLessonsPage({ kind }: { kind: 'QUIZ' | 'ASSIGNMENT' }) {
  const features = useFeatures();
  const quiz = kind === 'QUIZ';
  const feature = quiz ? features.data?.quizAttempts : features.data?.assignmentSubmissions;
  return (
    <>
      <PageHeader
        title={quiz ? 'Quizzes' : 'Assignments'}
        breadcrumbs={[home, { label: quiz ? 'Quizzes' : 'Assignments' }]}
        description={feature?.message}
      />
      <PagedList<StudentLessonListItem>
        path="/student/lessons"
        extra={{ contentType: kind }}
        label={quiz ? 'quizzes' : 'assignments'}
        empty={
          <EmptyState
            icon={quiz ? <FileQuestion /> : <NotebookPen />}
            title={quiz ? 'No quizzes in your courses' : 'No assignments in your courses'}
            description="When your faculty add them to your courses, they appear here."
          />
        }
      >
        {(items) => <LessonItems items={items} />}
      </PagedList>
    </>
  );
}

/** Live classes are not available yet; recorded lectures are the video lessons of the courses. */
export function ClassesPage() {
  const features = useFeatures();
  return (
    <>
      <PageHeader title="Classes" breadcrumbs={[home, { label: 'Classes' }]} />
      <section aria-labelledby="live-heading" className="grid gap-3">
        <h2 id="live-heading" className="type-h2 text-heading">
          Upcoming live classes
        </h2>
        {features.data ? (
          <FeatureUnavailable
            title="No live classes scheduled online"
            feature={features.data.liveClasses}
            icon={<MonitorPlay />}
          />
        ) : (
          <LoadingPanel rows={2} />
        )}
      </section>
      <section aria-labelledby="recorded-heading" className="grid gap-3">
        <h2 id="recorded-heading" className="type-h2 text-heading">
          Recorded lectures
        </h2>
        <PagedList<StudentLessonListItem>
          path="/student/lessons"
          extra={{ contentType: 'VIDEO' }}
          label="recorded lectures"
          empty={
            <EmptyState
              icon={<PlayCircle />}
              title="No recorded lectures yet"
              description="Video lessons of your courses appear here."
            />
          }
        >
          {(items) => <LessonItems items={items} />}
        </PagedList>
      </section>
    </>
  );
}

export function ExamsPage() {
  const features = useFeatures();
  return (
    <>
      <PageHeader title="Exams" breadcrumbs={[home, { label: 'Exams' }]} />
      {features.data ? (
        <FeatureUnavailable
          title="No examinations available"
          feature={features.data.exams}
          icon={<ClipboardList />}
        />
      ) : (
        <LoadingPanel rows={2} />
      )}
    </>
  );
}

export function ResultsPage() {
  const features = useFeatures();
  return (
    <>
      <PageHeader title="Results" breadcrumbs={[home, { label: 'Results' }]} />
      {features.data ? (
        <FeatureUnavailable
          title="No results published"
          feature={features.data.results}
          icon={<GraduationCap />}
          action={
            <Button asChild variant="outline">
              <Link href="/student/progress">See your course progress</Link>
            </Button>
          }
        />
      ) : (
        <LoadingPanel rows={2} />
      )}
    </>
  );
}

export function PaymentsPage() {
  const features = useFeatures();
  return (
    <>
      <PageHeader title="Payments" breadcrumbs={[home, { label: 'Payments' }]} />
      {features.data ? (
        <FeatureUnavailable
          title="No payment history"
          feature={features.data.payments}
          icon={<CreditCard />}
          action={
            <Button asChild variant="outline">
              <Link href="/contact">Contact the academy</Link>
            </Button>
          }
        />
      ) : (
        <LoadingPanel rows={2} />
      )}
    </>
  );
}

/** Progress of every active course, from the API's lesson-completion records. */
export function ProgressPage() {
  return (
    <>
      <PageHeader
        title="Progress"
        breadcrumbs={[home, { label: 'Progress' }]}
        description="Progress counts the published lessons you have marked complete. Quiz and assignment lessons are not counted yet."
      />
      <PagedList<StudentCourseCard>
        path="/student/courses"
        label="courses"
        empty={
          <EmptyState
            icon={<TrendingUp />}
            title="No progress to show yet"
            description="Enrol in a course and complete lessons to see your progress here."
            action={
              <Button asChild>
                <Link href="/student/courses?tab=find">Find courses</Link>
              </Button>
            }
          />
        }
      >
        {(items) => (
          <ul className="grid gap-3">
            {items.map((course) => (
              <li key={course.id}>
                <Card className="gap-4 md:flex-row md:items-center">
                  <div className="grid min-w-0 flex-1 gap-1">
                    <h2 className="type-h4 text-heading">
                      <Link
                        href={courseHref(course.id)}
                        className="hover:text-primary hover:underline"
                      >
                        {course.title}
                      </Link>
                    </h2>
                    <span className="type-caption text-muted-foreground">
                      {course.enrollment.lastActivityAt
                        ? `Last studied ${formatDateTime(course.enrollment.lastActivityAt)}`
                        : 'Not started yet'}
                      {course.progress.completedAt
                        ? ` · Completed ${formatDate(course.progress.completedAt)}`
                        : ''}
                    </span>
                  </div>
                  <div className="w-full md:w-72">
                    <CourseProgress progress={course.progress} label={`${course.title} progress`} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PagedList>
    </>
  );
}

/** Completed courses; no certificate is generated until the certificate system exists. */
export function CertificatesPage() {
  const features = useFeatures();
  return (
    <>
      <PageHeader
        title="Certificates"
        breadcrumbs={[home, { label: 'Certificates' }]}
        description={features.data?.certificates.message}
      />
      <PagedList<StudentEnrollmentRecord>
        path="/student/enrollments"
        extra={{ completed: 'true' }}
        label="completed courses"
        empty={
          <EmptyState
            icon={<Award />}
            title="No certificates"
            description="No certificate has been issued to you. Completed courses will be listed here."
          />
        }
      >
        {(items) => (
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item.enrollment.id}>
                <Card className="gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-1">
                    <h2 className="type-h4 text-heading">{item.course.title}</h2>
                    <span className="type-caption text-muted-foreground">
                      All lessons completed on {formatDate(item.completedAt)}
                    </span>
                  </div>
                  <Badge variant="secondary">No certificate issued</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PagedList>
    </>
  );
}

/** The student's own recent lesson activity. */
export function HistoryPage() {
  return (
    <>
      <PageHeader
        title="Learning history"
        breadcrumbs={[home, { label: 'Learning history' }]}
        description="Lessons you have opened, most recent first."
      />
      <PagedList<LearningHistoryItem>
        path="/student/history"
        label="history"
        empty={
          <EmptyState
            icon={<History />}
            title="No learning activity yet"
            description="Lessons you open will appear here."
          />
        }
      >
        {(items) => (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y">
              {items.map((item) => (
                <li
                  key={item.lesson.lessonId}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <Link
                      href={learnHref(item.course.id, item.lesson.lessonId)}
                      className="type-label break-words text-primary hover:underline"
                    >
                      {item.lesson.lessonTitle}
                    </Link>
                    <span className="type-caption text-muted-foreground">
                      {item.course.title} · {item.lesson.moduleTitle} › {item.lesson.chapterTitle}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-1 text-right">
                    {item.completedAt ? (
                      <Badge variant="success">
                        <CheckCircle2 aria-hidden /> Completed {formatDate(item.completedAt)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{lessonTypeLabel(item.lesson.contentType)}</Badge>
                    )}
                    <span className="type-caption text-muted-foreground">
                      Last opened {formatDateTime(item.lastViewedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PagedList>
    </>
  );
}

const lessonTypeLabel = (type: LessonContentType) => LESSON_TYPE_LABELS[type];

/** Enrolment records (including cancelled ones) for the profile page. */
export function EnrollmentRecords() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Enrolled courses</CardTitle>
      </CardHeader>
      <CardContent>
        <PagedList<StudentEnrollmentRecord>
          path="/student/enrollments"
          label="enrolments"
          empty={<p className="type-body-sm text-muted-foreground">No enrolments yet.</p>}
        >
          {(items) => (
            <ul className="divide-y">
              {items.map((item) => (
                <li
                  key={item.enrollment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="grid gap-0.5">
                    <Link
                      href={courseHref(item.course.id)}
                      className="type-label text-primary hover:underline"
                    >
                      {item.course.title}
                    </Link>
                    <span className="type-caption text-muted-foreground">
                      Enrolled {formatDate(item.enrollment.enrolledAt)} ·{' '}
                      {item.enrollment.source === 'FREE' ? 'Free course' : 'By the academy'}
                    </span>
                  </div>
                  <Badge variant={item.enrollment.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {item.enrollment.status === 'ACTIVE'
                      ? 'Active'
                      : `Cancelled ${formatDate(item.enrollment.cancelledAt) ?? ''}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </PagedList>
      </CardContent>
    </Card>
  );
}
