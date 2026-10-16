'use client';

import type {
  LessonProgressUpdateDto,
  StudentCurriculumDto,
  StudentFeatures,
  StudentLessonDto,
} from '@asra/types';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTree,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import { ApiClientError } from '@/lib/api';
import { formatClock, LESSON_TYPE_LABELS, courseHref, learnHref } from '@/lib/student/learning';

import { CurriculumNav } from './curriculum-nav';
import { LessonContent } from './lesson-content';
import { CourseProgress, ErrorPanel, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

/**
 * `/student/learn/[courseId]?lesson=<id>` — the course player. Without `?lesson` it resumes at the
 * lesson the API reports (last valid lesson, else the first). Opening a lesson is recorded once
 * per lesson view; completion is an explicit action stored by the API.
 */
export function CoursePlayer({ courseId }: { courseId: string }) {
  const api = useStudentApi();
  const router = useRouter();
  const lessonId = useSearchParams().get('lesson');

  const curriculumPath = `/student/courses/${courseId}/curriculum`;
  const curriculum = useApiResource(curriculumPath, () =>
    api.get<StudentCurriculumDto>(curriculumPath),
  );
  const lessonPath = lessonId ? `/student/lessons/${lessonId}` : null;
  const lesson = useApiResource(lessonPath, () => api.get<StudentLessonDto>(lessonPath!));
  const features = useApiResource('/student/features', () =>
    api.get<StudentFeatures>('/student/features'),
  );

  // Resume: no lesson in the URL → go to the API's resume lesson.
  const resumeId = curriculum.data?.resumeLessonId;
  React.useEffect(() => {
    if (!lessonId && resumeId) router.replace(learnHref(courseId, resumeId));
  }, [lessonId, resumeId, courseId, router]);

  // A lesson id from another course: follow it to its own course (access is still enforced).
  const lessonCourseId = lesson.data?.course.id;
  React.useEffect(() => {
    if (lessonId && lessonCourseId && lessonCourseId !== courseId) {
      router.replace(learnHref(lessonCourseId, lessonId));
    }
  }, [lessonId, lessonCourseId, courseId, router]);

  // Record "opened" once per lesson view (Strict Mode runs effects twice in development).
  const recorded = React.useRef<string | null>(null);
  const loadedLessonId = lesson.data?.id;
  React.useEffect(() => {
    if (!loadedLessonId || recorded.current === loadedLessonId) return;
    recorded.current = loadedLessonId;
    api.post(`/student/lessons/${loadedLessonId}/activity`).catch(() => {
      // Not worth interrupting the student: the next action records activity again.
    });
  }, [loadedLessonId, api]);

  const curriculumError = curriculum.error && !curriculum.data ? curriculum.error : null;
  if (curriculumError) {
    const status = curriculumError instanceof ApiClientError ? curriculumError.status : 0;
    return (
      <>
        <PageHeader
          title="Course"
          breadcrumbs={[{ label: 'My courses', href: '/student/courses' }]}
        />
        {status === 403 ? (
          <EmptyState
            title="You are not enrolled in this course"
            description="Enrol in the course to open its lessons."
            action={
              <Button asChild>
                <Link href={courseHref(courseId)}>View the course</Link>
              </Button>
            }
          />
        ) : status === 404 || status === 422 ? (
          <EmptyState
            title="Course not available"
            description="This course does not exist or is not published."
            action={
              <Button asChild variant="outline">
                <Link href="/student/courses">Back to my courses</Link>
              </Button>
            }
          />
        ) : (
          <ErrorPanel message={errorMessage(curriculumError)} onRetry={curriculum.reload} />
        )}
      </>
    );
  }
  if (!curriculum.data) return <LoadingPanel label="Loading course…" rows={6} />;

  if (!lessonId) {
    return resumeId ? (
      <LoadingPanel label="Opening your lesson…" rows={4} />
    ) : (
      <EmptyState
        title="No lessons yet"
        description="No lessons are published in this course yet. Please check back later."
        action={
          <Button asChild variant="outline">
            <Link href={courseHref(courseId)}>Back to course</Link>
          </Button>
        }
      />
    );
  }

  const sidebar = (
    <div className="grid gap-4">
      <CourseProgress progress={curriculum.data.progress} />
      <CurriculumNav
        courseId={courseId}
        modules={curriculum.data.modules}
        currentLessonId={lessonId}
      />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {lesson.error && !lesson.data ? (
          <LessonError error={lesson.error} courseId={courseId} onRetry={lesson.reload} />
        ) : !lesson.data || lesson.data.id !== lessonId ? (
          <LoadingPanel label="Loading lesson…" rows={6} />
        ) : (
          <LessonView
            lesson={lesson.data}
            features={features.data}
            sidebar={sidebar}
            onLessonChange={lesson.replace}
            onCourseChange={curriculum.reload}
          />
        )}
      </div>
      <aside
        aria-label="Course contents"
        className="sticky top-[calc(var(--spacing-topbar)+1.5rem)] hidden max-h-[calc(100dvh-var(--spacing-topbar)-3rem)] overflow-y-auto lg:block"
      >
        {sidebar}
      </aside>
    </div>
  );
}

function LessonError({
  error,
  courseId,
  onRetry,
}: {
  error: Error;
  courseId: string;
  onRetry: () => void;
}) {
  const status = error instanceof ApiClientError ? error.status : 0;
  if (status === 404 || status === 422 || status === 403) {
    return (
      <EmptyState
        title="Lesson not available"
        description="This lesson does not exist, is not published, or is not part of your courses."
        action={
          <Button asChild variant="outline">
            <Link href={learnHref(courseId)}>Go to my current lesson</Link>
          </Button>
        }
      />
    );
  }
  return <ErrorPanel message={errorMessage(error)} onRetry={onRetry} />;
}

function LessonView({
  lesson,
  features,
  sidebar,
  onLessonChange,
  onCourseChange,
}: {
  lesson: StudentLessonDto;
  features: StudentFeatures | undefined;
  sidebar: React.ReactNode;
  onLessonChange: (lesson: StudentLessonDto) => void;
  onCourseChange: () => void;
}) {
  const api = useStudentApi();
  const [pending, setPending] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const completed = Boolean(lesson.progress?.completedAt);
  const clock = formatClock(lesson.durationSeconds);
  const { previous, next } = lesson.navigation;

  function applyUpdate(update: LessonProgressUpdateDto) {
    onLessonChange({ ...lesson, progress: update.progress });
  }

  async function toggleComplete() {
    setPending(true);
    try {
      const update = completed
        ? await api.del<LessonProgressUpdateDto>(`/student/lessons/${lesson.id}/complete`)
        : await api.post<LessonProgressUpdateDto>(`/student/lessons/${lesson.id}/complete`);
      applyUpdate(update);
      onCourseChange();
      if (completed) {
        toast.info('Marked as not complete');
      } else if (update.course.percent === 100) {
        toast.success('Course complete', {
          description: 'You have completed every lesson in this course.',
        });
      } else {
        toast.success('Lesson complete', {
          description: `${update.course.completedLessons} of ${update.course.totalLessons} lessons done.`,
        });
      }
    } catch (error) {
      toast.error('Could not save your progress', { description: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  const fallbackFeature = { available: false, message: '' };

  return (
    <>
      <PageHeader
        title={lesson.title}
        breadcrumbs={[
          { label: 'My courses', href: '/student/courses' },
          { label: lesson.course.title, href: courseHref(lesson.course.id) },
          { label: lesson.title },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {lesson.module.title} › {lesson.chapter.title}
            </span>
            <Badge variant="outline">{LESSON_TYPE_LABELS[lesson.contentType]}</Badge>
            {clock ? <Badge variant="secondary">{clock}</Badge> : null}
            {completed ? (
              <Badge variant="success">
                <CheckCircle2 aria-hidden /> Completed
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <ListTree aria-hidden /> Course contents
              </Button>
            </DrawerTrigger>
            <DrawerContent
              side="right"
              onClick={(event) => {
                if ((event.target as Element).closest('a')) setDrawerOpen(false);
              }}
            >
              <DrawerHeader>
                <DrawerTitle>{lesson.course.title}</DrawerTitle>
                <DrawerDescription>Course contents and progress</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>{sidebar}</DrawerBody>
            </DrawerContent>
          </Drawer>
        }
      />

      {lesson.description ? (
        <p className="max-w-prose type-body whitespace-pre-line text-muted-foreground">
          {lesson.description}
        </p>
      ) : null}

      <LessonContent
        lesson={lesson}
        features={{
          quiz: features?.quizAttempts ?? fallbackFeature,
          assignment: features?.assignmentSubmissions ?? fallbackFeature,
        }}
        onVideoProgress={applyUpdate}
      />

      <div className="grid gap-4 border-t pt-6">
        {lesson.countsTowardProgress ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={toggleComplete}
              loading={pending}
              loadingText="Saving…"
              variant={completed ? 'outline' : 'default'}
            >
              {completed ? (
                <>
                  <RotateCcw aria-hidden /> Mark as not complete
                </>
              ) : (
                <>
                  <CheckCircle2 aria-hidden /> Mark lesson complete
                </>
              )}
            </Button>
            {lesson.progress?.videoCompletedAt ? (
              <span className="type-caption text-muted-foreground">
                You have watched this video.
              </span>
            ) : null}
          </div>
        ) : null}
        <nav
          aria-label="Lesson navigation"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          {previous ? (
            <Button asChild variant="ghost">
              <Link href={learnHref(lesson.course.id, previous.id)}>
                <ChevronLeft aria-hidden />
                <span className="grid text-left">
                  <span className="type-caption text-muted-foreground">Previous</span>
                  <span className="max-w-[14rem] truncate">{previous.title}</span>
                </span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href={courseHref(lesson.course.id)}>
                <ArrowLeft aria-hidden /> Back to course
              </Link>
            </Button>
          )}
          <span className="type-caption text-muted-foreground">
            Lesson {lesson.navigation.position} of {lesson.navigation.total}
          </span>
          {next ? (
            <Button asChild variant="ghost">
              <Link href={learnHref(lesson.course.id, next.id)}>
                <span className="grid text-right">
                  <span className="type-caption text-muted-foreground">Next</span>
                  <span className="max-w-[14rem] truncate">{next.title}</span>
                </span>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href={courseHref(lesson.course.id)}>
                Back to course <ArrowLeft className="rotate-180" aria-hidden />
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </>
  );
}
