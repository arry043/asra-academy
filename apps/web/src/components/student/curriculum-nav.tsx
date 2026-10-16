'use client';

import type { LessonContentType, PublicModuleOutline, StudentCurriculumModule } from '@asra/types';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  FileQuestion,
  FileText,
  Link2,
  NotebookPen,
  PlayCircle,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';

import { formatClock, LESSON_TYPE_LABELS, learnHref } from '@/lib/student/learning';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<LessonContentType, typeof PlayCircle> = {
  VIDEO: PlayCircle,
  PDF: FileText,
  DOCUMENT: FileText,
  LINK: Link2,
  QUIZ: FileQuestion,
  ASSIGNMENT: NotebookPen,
  TEXT: ScrollText,
};

/**
 * Module → Chapter → Lesson navigation in CMS order, with completion marks and the current lesson.
 * Modules are native <details> disclosures: keyboard accessible without extra script.
 */
export function CurriculumNav({
  courseId,
  modules,
  currentLessonId,
  className,
}: {
  courseId: string;
  modules: StudentCurriculumModule[];
  currentLessonId?: string | null;
  className?: string;
}) {
  return (
    <nav aria-label="Course contents" className={cn('grid gap-3', className)}>
      {modules.map((module, moduleIndex) => {
        const lessons = module.chapters.flatMap((chapter) => chapter.lessons);
        const done = lessons.filter((lesson) => lesson.completedAt).length;
        const containsCurrent = lessons.some((lesson) => lesson.id === currentLessonId);
        return (
          <details
            key={module.id}
            open={containsCurrent || !currentLessonId || undefined}
            className="group rounded-xl border bg-card"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="type-caption text-muted-foreground">Module {moduleIndex + 1}</span>
                <span className="type-label text-heading">{module.title}</span>
                <span className="type-caption text-muted-foreground">
                  {done} of {lessons.length} done
                </span>
              </span>
              <ChevronDown
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="grid gap-3 border-t px-2 py-3">
              {module.chapters.map((chapter) => (
                <div key={chapter.id} className="grid gap-1">
                  <h3 className="px-2 type-eyebrow text-muted-foreground">{chapter.title}</h3>
                  <ol className="grid gap-0.5">
                    {chapter.lessons.map((lesson) => {
                      const Icon = TYPE_ICONS[lesson.contentType];
                      const current = lesson.id === currentLessonId;
                      const clock = formatClock(lesson.durationSeconds);
                      return (
                        <li key={lesson.id}>
                          <Link
                            href={learnHref(courseId, lesson.id)}
                            aria-current={current ? 'page' : undefined}
                            className={cn(
                              'flex min-h-control items-start gap-2.5 rounded-lg px-2 py-2 type-body-sm transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50',
                              current && 'bg-secondary font-medium text-primary',
                            )}
                          >
                            {lesson.completedAt ? (
                              <CheckCircle2
                                className="mt-0.5 size-4 shrink-0 text-success"
                                aria-hidden
                              />
                            ) : (
                              <Circle
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                            <span className="grid min-w-0 flex-1">
                              <span className="break-words">{lesson.title}</span>
                              <span className="flex items-center gap-1 type-caption text-muted-foreground">
                                <Icon className="size-3.5" aria-hidden />
                                {LESSON_TYPE_LABELS[lesson.contentType]}
                                {clock ? ` · ${clock}` : null}
                              </span>
                            </span>
                            <span className="sr-only">
                              {lesson.completedAt ? '(completed)' : '(not completed)'}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

/** Lesson titles only — shown before enrolment (no links, no lesson ids). */
export function CourseOutline({ outline }: { outline: PublicModuleOutline[] }) {
  if (outline.length === 0) {
    return <p className="type-body text-muted-foreground">The curriculum will appear here.</p>;
  }
  return (
    <ol className="grid gap-3">
      {outline.map((module, index) => (
        <li key={`${module.title}-${index}`} className="rounded-xl border bg-card p-4">
          <p className="type-caption text-muted-foreground">Module {index + 1}</p>
          <h3 className="type-label text-heading">{module.title}</h3>
          {module.chapters.map((chapter, chapterIndex) => (
            <div key={`${chapter.title}-${chapterIndex}`} className="mt-3 grid gap-1">
              <h4 className="type-eyebrow text-muted-foreground">{chapter.title}</h4>
              <ul className="grid gap-1 type-body-sm">
                {chapter.lessons.map((lesson, lessonIndex) => {
                  const Icon = TYPE_ICONS[lesson.contentType];
                  return (
                    <li key={`${lesson.title}-${lessonIndex}`} className="flex items-center gap-2">
                      <Icon className="size-4 text-asra-sage" aria-hidden />
                      <span>{lesson.title}</span>
                      <span className="sr-only">({LESSON_TYPE_LABELS[lesson.contentType]})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}
