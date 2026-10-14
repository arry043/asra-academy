import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface Breadcrumb {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/** Title block for dashboard pages: breadcrumbs, the page `<h1>`, description and actions. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn('grid gap-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 type-caption text-muted-foreground">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.href && !last ? (
                    <Link
                      href={crumb.href}
                      className="rounded-sm hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={last ? 'page' : undefined}
                      className={cn(last && 'font-medium text-foreground')}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {last ? null : <ChevronRight className="size-3.5" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 gap-1.5">
          <h1 className="type-h1 break-words text-heading">{title}</h1>
          {description ? <p className="type-body text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
