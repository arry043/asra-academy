import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Subtle page-enter transition (250 ms fade + 8 px rise) in pure CSS: no JavaScript, no layout
 * shift (transform/opacity only) and nothing moves under `prefers-reduced-motion`.
 *
 * Use from a route segment's `template.tsx` — templates re-mount on navigation, so the animation
 * replays per page while layouts (navbar, sidebar) stay mounted and still.
 */
export function PageTransition({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="page-transition" className={cn('motion-safe:animate-page-in', className)}>
      {children}
    </div>
  );
}
