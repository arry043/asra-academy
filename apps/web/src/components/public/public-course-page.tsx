import type { PublicCourseDetail } from '@asra/types';
import { PlayCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Section } from '@/components/layout/section';
import { CtaBand } from '@/components/public/cta-band';
import { PageHero } from '@/components/public/page-hero';
import { WhatsAppLink } from '@/components/public/whatsapp-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LESSON_TYPE_LABELS } from '@/lib/admin/format';
import { toParagraphs } from '@/lib/catalog';
import { formatDuration } from '@/lib/format';

/**
 * Public page of a published course (FR-CRS-004). Shows only what the public API returns: the
 * description, placement, learning time, public faculty and the outline of published lessons.
 * No prices (payments are PHASE 10), lesson bodies or resource links (enrolled students only).
 */
export function PublicCoursePage({ course }: { course: PublicCourseDetail }) {
  const path = `/courses/${course.slug}`;
  const placement = [course.class?.name, course.stream?.name, course.subject?.name]
    .filter(Boolean)
    .join(' · ');
  const facts: [string, string][] = [
    ...(course.category ? [['Category', course.category.name] as [string, string]] : []),
    ...(course.class ? [['Class', course.class.name] as [string, string]] : []),
    ...(course.stream ? [['Stream', course.stream.name] as [string, string]] : []),
    ...(course.subject ? [['Subject', course.subject.name] as [string, string]] : []),
    ...(course.durationMinutes
      ? [['Learning time', formatDuration(course.durationMinutes)!] as [string, string]]
      : []),
    ['Lessons', String(course.lessonCount)],
    ['Mode', 'Online'],
  ];
  const description = toParagraphs(course.description);

  return (
    <>
      <PageHero
        path={path}
        breadcrumbs={[{ label: 'Courses', href: '/courses' }, { label: course.title }]}
        eyebrow={course.category?.name ?? 'Course'}
        title={course.title}
        description={
          course.summary ? <p>{course.summary}</p> : placement ? <p>{placement}</p> : undefined
        }
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/contact?topic=admission">Enquire about this course</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/admission">Admission</Link>
            </Button>
            <WhatsAppLink topic={`the ${course.title} course`} size="lg" />
          </>
        }
        aside={
          <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-card">
            {course.thumbnailUrl ? (
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-asra-green-50">
                <Image
                  src={course.thumbnailUrl}
                  alt={`${course.title} cover image`}
                  fill
                  sizes="22rem"
                  // Administrator-supplied HTTPS URL on any host (see CourseCard).
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
            <h2 className="type-h4 text-heading">At a glance</h2>
            <dl className="grid gap-3 type-body-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="grid gap-0.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Fees and batches</dt>
                <dd className="font-medium text-foreground">
                  To be announced —{' '}
                  <Link
                    href="/contact?topic=admission"
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    ask the academy
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        }
      />

      {description.length > 0 ? (
        <Section title="About this course" containerSize="narrow">
          <div className="grid gap-4 type-body text-foreground">
            {description.map((paragraph) => (
              <p key={paragraph} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        tone="muted"
        title="Course outline"
        description={`${course.lessonCount} ${course.lessonCount === 1 ? 'lesson' : 'lessons'} organised into modules and chapters.`}
        containerSize="narrow"
      >
        <ol className="grid gap-4" aria-label="Modules">
          {course.curriculum.map((module, moduleIndex) => (
            <li
              key={`${module.title}-${moduleIndex}`}
              className="rounded-xl border bg-card p-5 shadow-card"
            >
              <h3 className="type-h4 text-heading">
                Module {moduleIndex + 1}: {module.title}
              </h3>
              {module.description ? (
                <p className="mt-1 type-body-sm text-muted-foreground">{module.description}</p>
              ) : null}
              <ol className="mt-4 grid gap-4">
                {module.chapters.map((chapter, chapterIndex) => (
                  <li key={`${chapter.title}-${chapterIndex}`} className="grid gap-2">
                    <h4 className="type-label text-heading">{chapter.title}</h4>
                    <ol className="grid gap-1.5 border-l-2 border-asra-green-100 pl-4">
                      {chapter.lessons.map((lesson, lessonIndex) => (
                        <li
                          key={`${lesson.title}-${lessonIndex}`}
                          className="flex flex-wrap items-center gap-2 type-body-sm"
                        >
                          <PlayCircle
                            className="size-4 shrink-0 text-asra-sage-strong"
                            aria-hidden
                          />
                          <span className="text-foreground">{lesson.title}</span>
                          <Badge variant="outline">{LESSON_TYPE_LABELS[lesson.contentType]}</Badge>
                          {lesson.durationSeconds ? (
                            <span className="type-caption text-muted-foreground">
                              {formatDuration(lesson.durationSeconds / 60)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </Section>

      {course.instructors.length > 0 ? (
        <Section title="Faculty" containerSize="narrow">
          <ul className="grid gap-3 sm:grid-cols-2">
            {course.instructors.map((instructor) => (
              <li key={instructor.fullName} className="rounded-xl border bg-card p-4 shadow-card">
                <p className="type-label text-heading">{instructor.fullName}</p>
                {instructor.designation ? (
                  <p className="type-body-sm text-muted-foreground">{instructor.designation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CtaBand
        title="Interested in this course?"
        description="Ask the academy about batches, fees and admission."
        whatsAppTopic={`the ${course.title} course`}
        primary={{ label: 'Send an enquiry', href: '/contact?topic=admission' }}
        secondary={{ label: 'All courses', href: '/courses' }}
        tertiary={null}
      />
    </>
  );
}
