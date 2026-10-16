'use client';

import type { StudentCourseOverview } from '@asra/types';
import { Clock, UserRound } from 'lucide-react';
import Link from 'next/link';

import { MetaList } from '@/components/asra/shared/card-parts';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiClientError } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { courseEyebrow, learnHref } from '@/lib/student/learning';

import { EnrolButton } from './student-courses';
import { CourseOutline, CurriculumNav } from './curriculum-nav';
import { CourseProgress, CourseThumb, ErrorPanel, LessonPath, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

const crumbs = [
  { label: 'Dashboard', href: '/student/dashboard' },
  { label: 'My courses', href: '/student/courses' },
];

/** `/student/courses/[courseId]`: overview, access state and curriculum. */
export function CourseOverview({ courseId }: { courseId: string }) {
  const api = useStudentApi();
  const path = `/student/courses/${courseId}`;
  const overview = useApiResource(path, () => api.get<StudentCourseOverview>(path));

  if (overview.error && !overview.data) {
    const missing =
      overview.error instanceof ApiClientError &&
      (overview.error.status === 404 || overview.error.status === 422);
    return (
      <>
        <PageHeader
          title={missing ? 'Course not found' : 'Course'}
          breadcrumbs={[...crumbs, { label: 'Not found' }]}
        />
        {missing ? (
          <div className="grid justify-items-start gap-3">
            <p className="type-body text-muted-foreground">
              This course does not exist or is not available.
            </p>
            <Button asChild variant="outline">
              <Link href="/student/courses">Back to my courses</Link>
            </Button>
          </div>
        ) : (
          <ErrorPanel message={errorMessage(overview.error)} onRetry={overview.reload} />
        )}
      </>
    );
  }
  if (!overview.data) return <LoadingPanel label="Loading course…" rows={6} />;

  const course = overview.data;
  const eyebrow = courseEyebrow(course);
  const duration = formatDuration(course.durationMinutes);
  const paragraphs = (course.description ?? '').split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      <PageHeader
        title={course.title}
        description={eyebrow || undefined}
        breadcrumbs={[...crumbs, { label: course.title }]}
      />

      <Card className="gap-0 overflow-hidden p-0 sm:p-0 md:flex-row">
        <CourseThumb
          course={course}
          className="md:w-2/5 md:shrink-0"
          sizes="(min-width: 768px) 40vw, 100vw"
        />
        <CardContent className="grid content-start gap-4 p-5 sm:p-6">
          {course.summary ? <p className="type-body-lg">{course.summary}</p> : null}
          <MetaList
            items={[
              {
                icon: UserRound,
                label: 'Faculty',
                value: course.instructors.map((i) => i.fullName).join(', ') || null,
              },
              { icon: Clock, label: 'Learning time', value: duration ? `About ${duration}` : null },
            ]}
          />
          <AccessPanel course={course} onEnrolled={overview.replace} />
        </CardContent>
      </Card>

      {paragraphs.length > 0 ? (
        <section aria-labelledby="about-heading" className="grid max-w-prose gap-3">
          <h2 id="about-heading" className="type-h2 text-heading">
            About this course
          </h2>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="type-body whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="curriculum-heading" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="curriculum-heading" className="type-h2 text-heading">
            Curriculum
          </h2>
          <span className="type-body-sm text-muted-foreground">
            {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
          </span>
        </div>
        {course.curriculum ? (
          <CurriculumNav courseId={course.id} modules={course.curriculum.modules} />
        ) : (
          <CourseOutline outline={course.outline} />
        )}
      </section>
    </>
  );
}

function AccessPanel({
  course,
  onEnrolled,
}: {
  course: StudentCourseOverview;
  onEnrolled: (course: StudentCourseOverview) => void;
}) {
  if (course.access === 'ENROLLED' && course.curriculum) {
    const progress = course.curriculum.progress;
    return (
      <div className="grid gap-3">
        <Badge variant="success" className="justify-self-start">
          Enrolled
        </Badge>
        <CourseProgress progress={progress} />
        {course.resumeLesson ? (
          <>
            <LessonPath lesson={course.resumeLesson} />
            <Button asChild className="justify-self-start">
              <Link href={learnHref(course.id, course.resumeLesson.lessonId)}>
                {course.enrollment?.lastActivityAt ? 'Continue learning' : 'Start course'}
              </Link>
            </Button>
          </>
        ) : (
          <p className="type-body-sm text-muted-foreground">
            No lessons are published in this course yet.
          </p>
        )}
      </div>
    );
  }
  if (course.access === 'FREE_ENROLMENT') {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="type-body text-muted-foreground">
          This course is free. Enrol to open the lessons and save your progress.
        </p>
        <EnrolButton
          courseId={course.id}
          title={course.title}
          onEnrolled={onEnrolled}
          size="default"
        />
      </div>
    );
  }
  return (
    <Alert
      tone="info"
      title={
        course.enrollment?.status === 'CANCELLED'
          ? 'Your enrolment in this course was cancelled'
          : 'Enrolment is arranged by the academy'
      }
    >
      <p>
        Online payment is not available yet. Contact ASRA Academy to join this course; once the
        academy enrols you, the lessons open here.
      </p>
      <div>
        <Button asChild size="sm" variant="outline">
          <Link href="/contact">Contact the academy</Link>
        </Button>
      </div>
    </Alert>
  );
}
