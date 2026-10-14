import * as React from 'react';

import { cn } from '@/lib/utils';

/** A titled example inside a showcase section. Titles are h3 (sections are h2). */
export function ShowcaseBlock({
  title,
  description,
  id,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={cn('grid min-w-0 scroll-mt-28 gap-4', className)}>
      <div className="grid gap-1">
        <h3 className="type-h3 text-heading">{title}</h3>
        {description ? <p className="type-body-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Bordered canvas for examples. */
export function Specimen({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 rounded-xl border bg-card p-4 shadow-card sm:p-6', className)}>
      {children}
    </div>
  );
}

/** Small label under a specimen, e.g. a class name or token. */
export function Caption({ children }: { children: React.ReactNode }) {
  return <p className="type-caption text-muted-foreground">{children}</p>;
}

export function TokenCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.8125em] text-foreground">
      {children}
    </code>
  );
}
