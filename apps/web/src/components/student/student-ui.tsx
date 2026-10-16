'use client';

import type {
  CourseProgressDto,
  FeatureStatus,
  LessonLocator,
  PaginationMeta,
  StudentCourseRef,
} from '@asra/types';
import { BookOpen, CheckCircle2, Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/public/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { formatDateTime } from '@/lib/format';
import {
  courseEyebrow,
  courseHref,
  LESSON_TYPE_LABELS,
  learnHref,
  progressDetail,
} from '@/lib/student/learning';
import { cn } from '@/lib/utils';

export { ErrorPanel, LoadingPanel } from '@/components/admin/admin-ui';

/** Cover image or a branded panel; thumbnails are admin-supplied https URLs (R-01). */
export function CourseThumb({
  course,
  className,
  sizes = '(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 100vw',
}: {
  course: Pick<StudentCourseRef, 'thumbnailUrl' | 'title'>;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={cn('relative aspect-[16/9] overflow-hidden bg-asra-green-50', className)}>
      {course.thumbnailUrl ? (
        <Image
          src={course.thumbnailUrl}
          alt=""
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center" aria-hidden>
          <span className="flex size-12 items-center justify-center rounded-full bg-card text-asra-green-700 shadow-card [&_svg]:size-5">
            <BookOpen />
          </span>
        </div>
      )}
    </div>
  );
}

/** Progress bar + "x of y lessons" — never a fabricated percentage. */
export function CourseProgress({
  progress,
  label = 'Course progress',
  size,
}: {
  progress: CourseProgressDto;
  label?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <div className="grid gap-1.5">
      <Progress value={progress.percent} label={label} showValue size={size} />
      <p className="type-caption text-muted-foreground">{progressDetail(progress)}</p>
    </div>
  );
}

/** Where the student will continue: "Module › Chapter › Lesson". */
export function LessonPath({ lesson, className }: { lesson: LessonLocator; className?: string }) {
  return (
    <p className={cn('type-body-sm text-muted-foreground', className)}>
      <span className="sr-only">Next lesson: </span>
      {lesson.moduleTitle} › {lesson.chapterTitle} ›{' '}
      <span className="font-medium text-foreground">{lesson.lessonTitle}</span>{' '}
      <span className="whitespace-nowrap">({LESSON_TYPE_LABELS[lesson.contentType]})</span>
    </p>
  );
}

/** An enrolled course with progress and the resume action. */
export function EnrolledCourseCard({
  course,
  progress,
  resumeLesson,
  lastActivityAt,
  headingLevel = 'h3',
}: {
  course: StudentCourseRef;
  progress: CourseProgressDto;
  resumeLesson: LessonLocator | null;
  lastActivityAt: string | null;
  headingLevel?: 'h2' | 'h3';
}) {
  const eyebrow = courseEyebrow(course);
  const complete = progress.percent === 100;
  return (
    <Card className="h-full gap-4 overflow-hidden pt-0 sm:pt-0">
      <CourseThumb course={course} />
      <CardHeader className="gap-2">
        {eyebrow ? <Badge variant="accent">{eyebrow}</Badge> : null}
        <CardTitle as={headingLevel} className="line-clamp-2">
          <Link
            href={courseHref(course.id)}
            className="rounded-sm hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {course.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-auto grid gap-3">
        <CourseProgress progress={progress} />
        {resumeLesson && !complete ? <LessonPath lesson={resumeLesson} /> : null}
        {lastActivityAt ? (
          <p className="flex items-center gap-1.5 type-caption text-muted-foreground">
            <Clock className="size-3.5" aria-hidden /> Last studied {formatDateTime(lastActivityAt)}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {resumeLesson ? (
          <Button asChild size="sm">
            <Link href={learnHref(course.id, resumeLesson.lessonId)}>
              {complete ? (
                <>
                  <CheckCircle2 aria-hidden /> Review course
                </>
              ) : lastActivityAt ? (
                'Continue learning'
              ) : (
                'Start course'
              )}
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={courseHref(course.id)}>Open course</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Honest placeholder for a capability that is not available yet (reason from the API). */
export function FeatureUnavailable({
  title,
  feature,
  icon,
  action,
}: {
  title: string;
  feature: FeatureStatus;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={<p>{feature.message}</p>}
      action={action}
      headingLevel="h2"
    />
  );
}

/** Pagination for client-side lists; hidden when everything fits on one page. */
export function ListPager({
  pagination,
  onPageChange,
  label,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (pagination.pageCount <= 1) return null;
  return (
    <Pagination
      page={pagination.page}
      pageCount={pagination.pageCount}
      onPageChange={onPageChange}
      label={label}
    />
  );
}

export const cardGrid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
