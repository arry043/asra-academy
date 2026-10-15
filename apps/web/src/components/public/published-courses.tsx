import { BookOpen, CloudOff } from 'lucide-react';
import Link from 'next/link';

import { CourseCard, CourseCardSkeleton } from '@/components/asra/courses/course-card';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { LoadingRegion } from '@/components/ui/skeleton';
import { getPublishedCourses, toCourseCard } from '@/lib/catalog';

const PAGE_SIZE = 12;

/** Query key for the published-courses page; separate from the programme filters (?q, ?category). */
export const COURSES_PAGE_PARAM = 'coursesPage';

/**
 * Courses published by the academy (PHASE 06), from the public API. Shows an honest empty state
 * when nothing is published yet, and a non-blocking notice if the API is unreachable — the rest
 * of the page (programmes) still renders.
 */
export async function PublishedCourses({ page = 1 }: { page?: number }) {
  const result = await getPublishedCourses({ page, pageSize: PAGE_SIZE });

  if (!result.ok) {
    return (
      <Alert tone="warning" title="Course listings are unavailable right now">
        <p>{result.message} You can still browse the programmes below or send an enquiry.</p>
      </Alert>
    );
  }

  const { items, pagination } = result.data;
  if (pagination.total === 0) {
    return (
      <EmptyState
        icon={<BookOpen />}
        headingLevel="h3"
        title="No courses are published yet"
        description="The academy is preparing its courses. Explore the programmes below, or ask us about upcoming courses."
        action={
          <Button asChild variant="outline">
            <Link href="/contact">Send an enquiry</Link>
          </Button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CloudOff />}
        headingLevel="h3"
        title="This page has no courses"
        action={
          <Button asChild variant="outline">
            <Link href="/courses">Back to the first page</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((course, index) => (
          <li key={course.slug}>
            <CourseCard {...toCourseCard(course)} headingLevel="h3" priority={index < 3} />
          </li>
        ))}
      </ul>
      {pagination.pageCount > 1 ? (
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          getHref={(target) =>
            target === 1 ? '/courses' : `/courses?${COURSES_PAGE_PARAM}=${target}`
          }
          label="Published course pages"
        />
      ) : null}
    </div>
  );
}

export function PublishedCoursesSkeleton() {
  return (
    <LoadingRegion label="Loading courses…" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <CourseCardSkeleton key={index} />
      ))}
    </LoadingRegion>
  );
}
