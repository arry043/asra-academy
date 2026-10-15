import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { CourseCard } from '@/components/asra/courses/course-card';
import { getProgrammeVisual } from '@/components/public/programme-visuals';
import type { Programme } from '@/content/programmes';
import { toCourseSummary } from '@/lib/programmes';
import { cn } from '@/lib/utils';

/**
 * Responsive grid of programme cards. `columns` 3 → 1/2/3 per row; 4 → 1/2/4. An optional
 * "view all" tile can fill the last slot.
 */
export function ProgrammeGrid({
  items,
  headingLevel = 'h3',
  columns = 3,
  viewAll,
  className,
}: {
  items: Programme[];
  headingLevel?: 'h2' | 'h3' | 'h4';
  columns?: 3 | 4;
  viewAll?: { href: string; label: string; description?: string };
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid gap-5 sm:grid-cols-2',
        columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        className,
      )}
    >
      {items.map((programme) => (
        <li key={programme.slug}>
          <CourseCard
            {...toCourseSummary(programme)}
            {...getProgrammeVisual(programme.slug)}
            headingLevel={headingLevel}
          />
        </li>
      ))}
      {viewAll ? (
        <li>
          <Link
            href={viewAll.href}
            className="group flex h-full min-h-48 flex-col justify-between gap-6 rounded-xl bg-asra-green-900 p-6 text-asra-ivory shadow-card transition-[box-shadow,transform] duration-200 ease-standard outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:hover:-translate-y-0.5"
          >
            <span className="grid gap-2">
              <span className="type-h3">{viewAll.label}</span>
              {viewAll.description ? (
                <span className="type-body-sm text-asra-green-200">{viewAll.description}</span>
              ) : null}
            </span>
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-asra-gold-500 text-asra-green-950">
              <ArrowRight
                aria-hidden
                className="size-5 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
