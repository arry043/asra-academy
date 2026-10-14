import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Loading placeholder. Decorative (`aria-hidden`): wrap groups of skeletons in `<LoadingRegion>` so
 * assistive technology hears a single "Loading…" instead of many empty shapes.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-asra-green-100/70', className)}
      {...props}
    />
  );
}

/** Lines of text; the last line is shorter so the block reads as a paragraph. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}

/** Announces loading once (`role="status"`) and marks the region busy. */
function LoadingRegion({
  label = 'Loading…',
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { LoadingRegion, Skeleton, SkeletonText };
