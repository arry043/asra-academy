import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { JsonLd } from '@/components/public/json-ld';
import { Container } from '@/components/layout/container';
import { breadcrumbJsonLd, type BreadcrumbItem } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * Introduction band for inner public pages: breadcrumbs (also emitted as BreadcrumbList JSON-LD),
 * eyebrow, the page's single `<h1>`, a lead paragraph, actions and an optional aside.
 */
export function PageHero({
  title,
  eyebrow,
  description,
  breadcrumbs,
  path,
  actions,
  aside,
  children,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  /** Trail ending with the current page (no `href`). "Home" is added automatically. */
  breadcrumbs?: BreadcrumbItem[];
  /** Site path of this page, for structured data. */
  path: string;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  /** Extra content under the lead paragraph (badges, notices). */
  children?: React.ReactNode;
  className?: string;
}) {
  const trail = breadcrumbs?.length ? [{ label: 'Home', href: '/' }, ...breadcrumbs] : [];

  return (
    <div
      data-slot="page-hero"
      className={cn('border-b bg-asra-green-50 py-12 sm:py-16', className)}
    >
      <Container className={cn('grid gap-10', aside && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
        <div className="grid content-start gap-5">
          {trail.length > 0 ? (
            <>
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1 type-caption text-muted-foreground">
                  {trail.map((crumb, index) => {
                    const last = index === trail.length - 1;
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
                          <span aria-current="page" className="font-medium text-foreground">
                            {crumb.label}
                          </span>
                        )}
                        {last ? null : <ChevronRight className="size-3.5" aria-hidden />}
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <JsonLd data={breadcrumbJsonLd(trail, path)} />
            </>
          ) : null}
          <div className="grid max-w-3xl gap-4">
            {eyebrow ? <p className="type-eyebrow text-asra-gold-800">{eyebrow}</p> : null}
            <h1 className="type-h1 break-words text-heading">{title}</h1>
            {description ? (
              <div className="type-body-lg text-muted-foreground">{description}</div>
            ) : null}
            {children}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="content-start">{aside}</div> : null}
      </Container>
    </div>
  );
}
