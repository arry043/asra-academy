'use client';

import type { StudentDashboardDto } from '@asra/types';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  MonitorPlay,
  NotebookPen,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/format';
import { courseHref, learnHref } from '@/lib/student/learning';

import {
  cardGrid,
  CourseProgress,
  CourseThumb,
  EnrolledCourseCard,
  ErrorPanel,
  LessonPath,
  LoadingPanel,
} from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

/**
 * Student dashboard (PHASE 07 §4): one aggregated request (`GET /student/dashboard`). Every
 * number and list comes from the API; unavailable capabilities show the API's own explanation.
 */
export function StudentDashboard() {
  const api = useStudentApi();
  const dashboard = useApiResource('/student/dashboard', () =>
    api.get<StudentDashboardDto>('/student/dashboard'),
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
  const firstName = data.student.fullName.split(' ')[0] ?? data.student.fullName;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Pick up where you left off and keep track of your courses."
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active courses" value={data.stats.activeCourses} icon={<BookOpen />} />
        <Stat
          label="Lessons completed"
          value={data.stats.completedLessons}
          icon={<CheckCircle2 />}
        />
        <Stat label="Courses completed" value={data.stats.completedCourses} icon={<Award />} />
      </section>

      <section aria-labelledby="continue-heading" className="grid gap-4">
        <h2 id="continue-heading" className="type-h2 text-heading">
          Continue learning
        </h2>
        {data.continueLearning.length === 0 ? (
          <EmptyState
            icon={<PlayCircle />}
            title={data.totalCourses === 0 ? 'No courses yet' : 'Start your first lesson'}
            description={
              data.totalCourses === 0
                ? 'When you are enrolled in a course, it appears here. Free courses can be joined from the catalogue; for other courses the academy enrols you.'
                : 'Open one of your courses below to begin. Your place is saved as you learn.'
            }
            action={
              <Button asChild>
                <Link
                  href={data.totalCourses === 0 ? '/student/courses?tab=find' : '/student/courses'}
                >
                  {data.totalCourses === 0 ? 'Find a course' : 'Go to my courses'}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.continueLearning.map((item) => (
              <li key={item.course.id}>
                <Card className="h-full flex-row gap-4 overflow-hidden p-0 sm:p-0">
                  <CourseThumb
                    course={item.course}
                    className="hidden w-40 shrink-0 sm:block sm:aspect-auto"
                    sizes="10rem"
                  />
                  <div className="grid min-w-0 flex-1 gap-3 p-5">
                    <div className="grid gap-1">
                      <h3 className="line-clamp-2 type-h4 text-heading">{item.course.title}</h3>
                      <LessonPath lesson={item.lesson} />
                    </div>
                    <CourseProgress progress={item.progress} size="sm" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="type-caption text-muted-foreground">
                        {formatDateTime(item.lastActivityAt)}
                      </span>
                      <Button asChild size="sm">
                        <Link href={learnHref(item.course.id, item.lesson.lessonId)}>
                          Continue learning
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="courses-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="courses-heading" className="type-h2 text-heading">
            My courses
          </h2>
          {data.totalCourses > data.courses.length ? (
            <Button asChild variant="link">
              <Link href="/student/courses">View all {data.totalCourses} courses</Link>
            </Button>
          ) : null}
        </div>
        {data.courses.length === 0 ? (
          <p className="type-body text-muted-foreground">You are not enrolled in any course yet.</p>
        ) : (
          <div className={cardGrid}>
            {data.courses.map((course) => (
              <EnrolledCourseCard
                key={course.id}
                course={course}
                progress={course.progress}
                resumeLesson={course.resumeLesson}
                lastActivityAt={course.enrollment.lastActivityAt}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="learning-heading" className="grid gap-4">
        <h2 id="learning-heading" className="type-h2 text-heading">
          Classes and assessments
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureTile
            title="Upcoming classes"
            icon={<MonitorPlay />}
            href="/student/classes"
            text={data.features.liveClasses.message}
          />
          <FeatureTile
            title="Assignments"
            icon={<NotebookPen />}
            href="/student/assignments"
            text={
              data.assessments.assignments > 0
                ? `${data.assessments.assignments} assignment lesson${data.assessments.assignments === 1 ? '' : 's'} in your courses. ${data.features.assignmentSubmissions.message}`
                : 'No assignments in your courses yet.'
            }
          />
          <FeatureTile
            title="Quizzes"
            icon={<FileQuestion />}
            href="/student/quizzes"
            text={
              data.assessments.quizzes > 0
                ? `${data.assessments.quizzes} quiz lesson${data.assessments.quizzes === 1 ? '' : 's'} in your courses. ${data.features.quizAttempts.message}`
                : 'No quizzes in your courses yet.'
            }
          />
          <FeatureTile
            title="Exams"
            icon={<ClipboardList />}
            href="/student/exams"
            text={data.features.exams.message}
          />
        </div>
      </section>

      <section aria-labelledby="results-heading" className="grid gap-4">
        <h2 id="results-heading" className="type-h2 text-heading">
          Results and certificates
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle as="h3">Results</CardTitle>
              <CardDescription>{data.features.results.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline">
                <Link href="/student/progress">See course progress</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Completed courses</CardTitle>
              <CardDescription>{data.features.certificates.message}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.completedCourses.length === 0 ? (
                <p className="type-body-sm text-muted-foreground">No completed courses yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.completedCourses.map((item) => (
                    <li key={item.course.id} className="flex flex-wrap justify-between gap-2">
                      <Link
                        href={courseHref(item.course.id)}
                        className="type-label text-primary hover:underline"
                      >
                        {item.course.title}
                      </Link>
                      <span className="type-caption text-muted-foreground">
                        Completed {formatDate(item.completedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="flex-row items-center gap-4">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="grid">
        <span className="type-h2 text-heading tabular-nums">{value}</span>
        <span className="type-body-sm text-muted-foreground">{label}</span>
      </div>
    </Card>
  );
}

function FeatureTile({
  title,
  icon,
  href,
  text,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  text: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="gap-2">
        <span aria-hidden className="text-asra-sage-strong [&_svg]:size-5">
          {icon}
        </span>
        <CardTitle as="h3">{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Open {title.toLowerCase()}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
