import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Honest placeholder for content that does not exist yet (no faculty profiles, no blog posts, no
 * search results). Says what is missing and offers a real next step — never fake content.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel: Heading = 'h2',
  className,
}: {
  /** A Lucide icon element. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-4 rounded-2xl border border-dashed border-asra-green-200 bg-card px-6 py-12 text-center sm:px-10',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-6"
        >
          {icon}
        </span>
      ) : null}
      <div className="grid max-w-xl gap-2">
        <Heading className="type-h3 text-heading">{title}</Heading>
        {description ? <div className="type-body text-muted-foreground">{description}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
