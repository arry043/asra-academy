import * as React from 'react';

import { cn } from '@/lib/utils';

type FeatureCardProps = {
  title: string;
  description?: string;
  /** A Lucide icon element, e.g. `<Video />`. Sized and coloured by the card. */
  icon?: React.ReactNode;
  align?: 'start' | 'center';
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
};

/** Short platform highlight ("Live & recorded classes", "Doubt-solving support"). */
export function FeatureCard({
  title,
  description,
  icon,
  align = 'start',
  headingLevel: Heading = 'h3',
  className,
}: FeatureCardProps) {
  return (
    <div
      data-slot="feature-card"
      className={cn(
        'flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-card',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-asra-green-700 [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <div className="grid gap-1">
        <Heading className="type-h4 text-heading">{title}</Heading>
        {description ? <p className="type-body-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
