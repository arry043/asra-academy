import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProgrammePage } from '@/components/public/programme-page';
import { PublicCoursePage } from '@/components/public/public-course-page';
import { getPublicCourse } from '@/lib/catalog';
import { getProgramme } from '@/lib/programmes';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

/**
 * `/courses/<slug>` serves two kinds of page:
 *   1. the five special-course PROGRAMME pages (their slugs are reserved so no course can take
 *      them: RESERVED_COURSE_SLUGS in @asra/validation);
 *   2. any other slug: a PUBLISHED course from the public API (PHASE 06). Drafts, private and
 *      unknown slugs → 404.
 *
 * Rendered per request: a route cannot be prerendered for some slugs and switch to request-time
 * rendering for others at runtime (Next.js fails with DYNAMIC_SERVER_USAGE), and time-based
 * revalidation would keep an unpublished course visible. Programme pages are static content, so
 * rendering them per request is cheap.
 */
export const dynamic = 'force-dynamic';

function findProgramme(slug: string) {
  const programme = getProgramme(slug);
  return programme?.kind === 'special-course' ? programme : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const programme = findProgramme(slug);
  if (programme) {
    return buildPageMetadata({
      title: programme.seo.title,
      description: programme.seo.description,
      path: programme.href,
    });
  }
  const result = await getPublicCourse(slug);
  if (!result.ok) return { title: 'Course', robots: { index: false, follow: true } };
  const course = result.data;
  return buildPageMetadata({
    title: course.title,
    description:
      course.summary ??
      course.description?.slice(0, 160) ??
      `${course.title} — an online course at ASRA Academy.`,
    path: `/courses/${course.slug}`,
    // Unlisted courses are reachable by link only and must stay out of search results.
    noIndex: course.visibility === 'UNLISTED',
  });
}

export default async function CourseSlugPage({ params }: Props) {
  const { slug } = await params;
  const programme = findProgramme(slug);
  if (programme) return <ProgrammePage programme={programme} />;

  const result = await getPublicCourse(slug);
  if (!result.ok) {
    if (result.reason === 'not-found') notFound();
    // Handled by the (public) error boundary, which offers a retry.
    throw new Error(result.message);
  }
  return <PublicCoursePage course={result.data} />;
}
