import { Suspense } from 'react';

import { CourseCategoryCard } from '@/components/asra/categories/course-category-card';
import { Container } from '@/components/layout/container';
import { CourseDirectory } from '@/components/public/course-directory';
import { CtaBand } from '@/components/public/cta-band';
import { PageHero } from '@/components/public/page-hero';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { getProgrammeVisual } from '@/components/public/programme-visuals';
import {
  COURSES_PAGE_PARAM,
  PublishedCourses,
  PublishedCoursesSkeleton,
} from '@/components/public/published-courses';
import { programmes } from '@/content/programmes';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Courses',
  description:
    'Browse and search ASRA Academy programmes: Classes 6–10 and 11–12, English, Arabic and Urdu, Quranic Studies, and Entrepreneurship & Business.',
  path: '/courses',
});

export default async function CoursesPage({ searchParams }: PageProps<'/courses'>) {
  const raw = (await searchParams)[COURSES_PAGE_PARAM];
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const coursesPage =
    Number.isInteger(requested) && requested >= 1 && requested <= 1000 ? requested : 1;

  return (
    <>
      <PageHero
        path="/courses"
        breadcrumbs={[{ label: 'Courses' }]}
        eyebrow="Courses"
        title="Explore our courses"
        description={
          <p>
            School education for Classes 6–12 and special courses in languages, entrepreneurship and
            Quranic Studies. Search by subject or topic, or filter by category.
          </p>
        }
      />

      <Container className="grid gap-12 py-section">
        <nav aria-labelledby="programme-nav-title">
          <h2 id="programme-nav-title" className="sr-only">
            Browse by programme
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {programmes.map((programme) => (
              <li key={programme.slug}>
                <CourseCategoryCard
                  name={programme.title}
                  href={programme.href}
                  headingLevel="h3"
                  icon={getProgrammeVisual(programme.slug).icon}
                  tone={getProgrammeVisual(programme.slug).tone}
                />
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="published-courses-title" className="grid gap-6">
          <div className="grid gap-2">
            <h2 id="published-courses-title" className="type-h2 text-heading">
              Available courses
            </h2>
            <p className="type-body text-muted-foreground">
              Courses the academy has published, with their full outline.
            </p>
          </div>
          {/* Rendered per request from the public API: unpublished courses disappear at once. */}
          <Suspense fallback={<PublishedCoursesSkeleton />}>
            <PublishedCourses page={coursesPage} />
          </Suspense>
        </section>

        <section aria-labelledby="directory-title" className="grid gap-6">
          <h2 id="directory-title" className="type-h2 text-heading">
            Search all programmes
          </h2>
          {/* Server-rendered full list until the client reads the URL filters (and without JS). */}
          <Suspense fallback={<ProgrammeGrid items={programmes} />}>
            <CourseDirectory programmes={programmes} />
          </Suspense>
        </section>
      </Container>

      <CtaBand
        title="Not sure which course is right?"
        description="Tell us about the student and their goals, and the academy will help you choose."
        primary={{ label: 'Send an enquiry', href: '/contact' }}
        secondary={{ label: 'Admission', href: '/admission' }}
        tertiary={null}
      />
    </>
  );
}
