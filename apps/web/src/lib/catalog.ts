import type { Paginated, PublicCourseDetail, PublicCourseSummary } from '@asra/types';
import { slugSchema } from '@asra/validation';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

import { ApiClientError, apiRequest } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import type { CourseSummary } from '@/types/education';

/**
 * Public course catalogue (PHASE 06) — read from `GET /api/v1/courses`, which returns ONLY
 * published courses whose visibility allows it (enforced by the API, not here).
 *
 * `apiRequest` uses `cache: 'no-store'`, so pages that call these functions render per request:
 * unpublishing a course removes it from the website immediately (no stale static copy).
 */

export type CatalogResult<T> =
  { ok: true; data: T } | { ok: false; reason: 'not-found' | 'unavailable'; message: string };

const PUBLIC_TIMEOUT_MS = 5_000;

function failure(error: unknown): CatalogResult<never> {
  // Next.js control-flow errors (notFound, request-time bail-out) must never become "unavailable".
  unstable_rethrow(error);
  if (error instanceof ApiClientError && error.status === 404) {
    return { ok: false, reason: 'not-found', message: error.message };
  }
  return {
    ok: false,
    reason: 'unavailable',
    message: 'Course information is temporarily unavailable. Please try again shortly.',
  };
}

export async function getPublishedCourses(
  query: { page?: number; pageSize?: number } = {},
): Promise<CatalogResult<Paginated<PublicCourseSummary>>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 12),
  });
  try {
    const data = await apiRequest<Paginated<PublicCourseSummary>>(`/courses?${params.toString()}`, {
      timeoutMs: PUBLIC_TIMEOUT_MS,
    });
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

/**
 * One public course by slug. Invalid slugs never reach the API. Wrapped in React `cache` so
 * `generateMetadata` and the page share one request per render.
 */
export const getPublicCourse = cache(
  async (slug: string): Promise<CatalogResult<PublicCourseDetail>> => {
    if (!slugSchema.safeParse(slug).success) {
      return { ok: false, reason: 'not-found', message: 'Course not found' };
    }
    try {
      const data = await apiRequest<PublicCourseDetail>(`/courses/${encodeURIComponent(slug)}`, {
        timeoutMs: PUBLIC_TIMEOUT_MS,
      });
      return { ok: true, data };
    } catch (error) {
      return failure(error);
    }
  },
);

/** Maps a published course onto the shared `CourseCard` view model (no invented metadata). */
export function toCourseCard(course: PublicCourseSummary): CourseSummary {
  return {
    title: course.title,
    category: course.category?.name,
    subject:
      [course.class?.name, course.stream?.name, course.subject?.name].filter(Boolean).join(' · ') ||
      undefined,
    summary: course.summary ?? undefined,
    instructorName: course.instructors[0]?.fullName,
    imageSrc: course.thumbnailUrl ?? undefined,
    imageAlt: course.thumbnailUrl ? `${course.title} cover image` : undefined,
    durationLabel: formatDuration(course.durationMinutes) ?? undefined,
    action: { href: `/courses/${course.slug}`, label: 'View course' },
  };
}

/** Splits plain-text descriptions into paragraphs (text is rendered as text, never as HTML). */
export function toParagraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
