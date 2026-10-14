import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { getPaginationRange } from '@/lib/pagination';
import { cn } from '@/lib/utils';

type PaginationProps = {
  /** 1-based current page. Out-of-range values are clamped. */
  page: number;
  pageCount: number;
  /**
   * Link mode (server-friendly, crawlable): returns the URL for a page, e.g. `?page=3`.
   * Provide either `getHref` or `onPageChange`.
   */
  getHref?: (page: number) => string;
  /** Callback mode (client state): only usable from a Client Component. */
  onPageChange?: (page: number) => void;
  siblings?: number;
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
};

/**
 * Page navigation. Explicit by design: it renders links or buttons for the given page and count —
 * it never fetches data. The current page has `aria-current="page"`; boundary controls are
 * disabled. On small screens only Previous / "Page x of y" / Next are shown.
 */
function Pagination({
  page,
  pageCount,
  getHref,
  onPageChange,
  siblings = 1,
  label = 'Pagination',
  className,
}: PaginationProps) {
  const total = Math.max(1, Math.floor(pageCount) || 1);
  const current = Math.min(Math.max(1, Math.floor(page) || 1), total);
  const items = getPaginationRange(current, total, siblings);

  function control(
    target: number,
    content: React.ReactNode,
    options: { ariaLabel: string; isCurrent?: boolean; disabled?: boolean; className?: string },
  ) {
    const classes = cn(
      buttonVariants({ variant: options.isCurrent ? 'default' : 'ghost', size: 'icon-sm' }),
      'type-body-sm font-medium tabular-nums',
      options.className,
    );
    if (options.disabled) {
      return (
        <button type="button" disabled aria-label={options.ariaLabel} className={classes}>
          {content}
        </button>
      );
    }
    if (getHref) {
      return (
        <Link
          href={getHref(target)}
          aria-label={options.ariaLabel}
          aria-current={options.isCurrent ? 'page' : undefined}
          className={classes}
        >
          {content}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onPageChange?.(target)}
        aria-label={options.ariaLabel}
        aria-current={options.isCurrent ? 'page' : undefined}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return (
    <nav aria-label={label} data-slot="pagination" className={cn('flex justify-center', className)}>
      <ul className="flex items-center gap-1">
        <li>
          {control(current - 1, <ChevronLeft aria-hidden />, {
            ariaLabel: 'Previous page',
            disabled: current <= 1,
          })}
        </li>
        {items.map((item) =>
          item.type === 'ellipsis' ? (
            <li key={item.key} className="hidden sm:block" aria-hidden>
              <span className="flex size-control-sm items-center justify-center text-muted-foreground">
                <MoreHorizontal className="size-4" />
              </span>
            </li>
          ) : (
            <li key={item.page} className="hidden sm:block">
              {control(item.page, item.page, {
                ariaLabel:
                  item.page === current
                    ? `Page ${item.page}, current page`
                    : `Go to page ${item.page}`,
                isCurrent: item.page === current,
              })}
            </li>
          ),
        )}
        <li
          className="px-2 type-body-sm text-muted-foreground tabular-nums sm:hidden"
          aria-live="polite"
        >
          Page {current} of {total}
        </li>
        <li>
          {control(current + 1, <ChevronRight aria-hidden />, {
            ariaLabel: 'Next page',
            disabled: current >= total,
          })}
        </li>
      </ul>
    </nav>
  );
}

export { Pagination, type PaginationProps };
