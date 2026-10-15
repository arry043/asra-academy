import { Archive, BookOpen, Clock, Languages, PencilLine, UserRound } from 'lucide-react';
import Image from 'next/image';

import {
  CardLinkButton,
  MetaList,
  StatusBadge,
  type StatusDefinition,
} from '@/components/asra/shared/card-parts';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CategoryTone, CourseSummary, PublicationStatus } from '@/types/education';

// Published is the normal state, so it carries no badge; only exceptions are flagged.
const STATUS: Partial<Record<PublicationStatus, StatusDefinition>> = {
  DRAFT: { label: 'Draft', variant: 'warning', icon: PencilLine },
  ARCHIVED: { label: 'Archived', variant: 'secondary', icon: Archive },
};

// Imageless cover tones (same pastel pairs as CourseCategoryCard).
const TONES: Record<CategoryTone, { panel: string; icon: string }> = {
  sky: { panel: 'bg-tone-sky-soft', icon: 'text-tone-sky' },
  mint: { panel: 'bg-tone-mint-soft', icon: 'text-tone-mint' },
  amber: { panel: 'bg-tone-amber-soft', icon: 'text-tone-amber' },
  violet: { panel: 'bg-tone-violet-soft', icon: 'text-tone-violet' },
  rose: { panel: 'bg-tone-rose-soft', icon: 'text-tone-rose' },
  teal: { panel: 'bg-tone-teal-soft', icon: 'text-tone-teal' },
};

type CourseCardProps = CourseSummary & {
  headingLevel?: 'h2' | 'h3' | 'h4';
  /** Load the cover eagerly (first row above the fold). */
  priority?: boolean;
  className?: string;
};

/**
 * Course summary card. Shows only the data it is given — no invented prices, ratings or counts.
 * Missing cover images fall back to a neutral branded panel; long titles clamp to two lines.
 */
export function CourseCard({
  title,
  category,
  subject,
  summary,
  instructorName,
  imageSrc,
  imageAlt,
  status,
  durationLabel,
  language,
  action,
  icon,
  tone,
  headingLevel = 'h3',
  priority = false,
  className,
}: CourseCardProps) {
  const statusDef = status ? STATUS[status] : undefined;
  const eyebrow = [category, subject].filter(Boolean).join(' · ');

  return (
    <Card className={cn('h-full gap-4 overflow-hidden pt-0 sm:pt-0', className)}>
      <div className={cn('relative aspect-[16/9]', tone ? TONES[tone].panel : 'bg-asra-green-50')}>
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt ?? ''}
            fill
            priority={priority}
            // Course thumbnails are administrator-supplied HTTPS URLs on any host (no storage
            // provider yet, R-01). They are shown as-is instead of allow-listing every host for
            // the optimiser.
            unoptimized={/^https?:\/\//.test(imageSrc)}
            sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center" aria-hidden>
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded-full bg-card shadow-card [&_svg]:size-6',
                tone ? TONES[tone].icon : 'text-asra-green-700',
              )}
            >
              {icon ?? <BookOpen />}
            </span>
          </div>
        )}
        {statusDef ? (
          <StatusBadge status={statusDef} className="absolute top-3 left-3 shadow-card" />
        ) : null}
      </div>

      <CardHeader className="gap-2">
        {eyebrow ? <Badge variant="accent">{eyebrow}</Badge> : null}
        <CardTitle as={headingLevel} className="line-clamp-2">
          {title}
        </CardTitle>
        {summary ? <CardDescription className="line-clamp-3">{summary}</CardDescription> : null}
      </CardHeader>

      <CardContent className="mt-auto">
        <MetaList
          items={[
            { icon: UserRound, label: 'Instructor', value: instructorName },
            { icon: Clock, label: 'Duration', value: durationLabel },
            { icon: Languages, label: 'Language', value: language },
          ]}
        />
      </CardContent>

      {action ? (
        <CardFooter>
          <CardLinkButton action={action} className="w-full sm:w-auto" />
        </CardFooter>
      ) : null}
    </Card>
  );
}

/** Loading placeholder with the same geometry as `CourseCard`. */
export function CourseCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('h-full gap-4 overflow-hidden pt-0 sm:pt-0', className)} aria-hidden>
      <Skeleton className="aspect-[16/9] rounded-none" />
      <CardHeader className="gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-4/5" />
        <SkeletonText lines={2} />
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-control-sm w-32 rounded-full" />
      </CardFooter>
    </Card>
  );
}
