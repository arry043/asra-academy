import { ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { CategoryTone, CourseCategorySummary } from '@/types/education';

const TONES: Record<CategoryTone, { tile: string; icon: string }> = {
  sky: { tile: 'bg-tone-sky-soft', icon: 'text-tone-sky' },
  mint: { tile: 'bg-tone-mint-soft', icon: 'text-tone-mint' },
  amber: { tile: 'bg-tone-amber-soft', icon: 'text-tone-amber' },
  violet: { tile: 'bg-tone-violet-soft', icon: 'text-tone-violet' },
  rose: { tile: 'bg-tone-rose-soft', icon: 'text-tone-rose' },
  teal: { tile: 'bg-tone-teal-soft', icon: 'text-tone-teal' },
};

const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'he']);

type CourseCategoryCardProps = CourseCategorySummary & {
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
};

/**
 * Category tile (Class 6–8, English, Urdu…) in the pastel style of the visual reference. With
 * `href`, the whole tile is clickable through a single "stretched" link on the name, so it is one
 * tab stop with a meaningful accessible name.
 */
export function CourseCategoryCard({
  name,
  description,
  courseCount,
  icon,
  tone = 'mint',
  href,
  lang,
  headingLevel: Heading = 'h3',
  className,
}: CourseCategoryCardProps) {
  const toneClasses = TONES[tone];
  const dir = lang && RTL_LANGS.has(lang.split('-')[0]!) ? 'rtl' : undefined;
  const hasCount =
    typeof courseCount === 'number' && Number.isFinite(courseCount) && courseCount >= 0;

  return (
    <div
      data-slot="course-category-card"
      className={cn(
        'group relative flex h-full flex-col items-center gap-2 rounded-xl p-4 text-center sm:p-5',
        toneClasses.tile,
        href &&
          'transition-[box-shadow,transform] duration-200 ease-standard hover:shadow-raised has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50 motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-lg bg-card/80 [&_svg]:size-6',
          toneClasses.icon,
        )}
      >
        {icon ?? <BookOpen />}
      </span>
      <Heading className="type-h4 break-words text-heading">
        {href ? (
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
          >
            <span lang={lang} dir={dir}>
              {name}
            </span>
          </Link>
        ) : (
          <span lang={lang} dir={dir}>
            {name}
          </span>
        )}
      </Heading>
      {description ? <p className="type-caption text-muted-foreground">{description}</p> : null}
      {hasCount ? (
        <p className="type-caption font-medium text-foreground">
          {courseCount} {courseCount === 1 ? 'course' : 'courses'}
        </p>
      ) : null}
      {href ? (
        <ArrowRight
          aria-hidden
          className={cn(
            'mt-auto size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5',
            toneClasses.icon,
          )}
        />
      ) : null}
    </div>
  );
}
