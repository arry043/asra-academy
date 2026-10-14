import * as React from 'react';

import { cn } from '@/lib/utils';

type TableProps = React.ComponentProps<'table'> & {
  /**
   * Name for the scroll container. When set, the container becomes a focusable, labelled region so
   * keyboard users can scroll a wide table horizontally on small screens.
   */
  scrollLabel?: string;
  containerClassName?: string;
};

/**
 * Semantic table in a horizontally scrolling container: dense desktop tables stay usable on narrow
 * screens without squashing columns or overflowing the page.
 */
function Table({ className, scrollLabel, containerClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      role={scrollLabel ? 'region' : undefined}
      aria-label={scrollLabel}
      tabIndex={scrollLabel ? 0 : undefined}
      className={cn(
        'relative w-full overflow-x-auto rounded-xl border bg-card shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom type-body-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('bg-muted/70 [&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-asra-green-50 data-[state=selected]:bg-secondary',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, scope = 'col', ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        'h-control-sm px-4 text-left align-middle type-caption font-semibold whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('px-4 py-3 type-caption text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Full-width row shown when a table has no data. */
function TableEmpty({
  colSpan,
  title = 'Nothing to show yet',
  description,
  action,
}: {
  colSpan: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <tr data-slot="table-empty">
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <div className="mx-auto grid max-w-sm justify-items-center gap-1.5">
          <p className="type-h4 text-heading">{title}</p>
          {description ? <p className="type-body-sm text-muted-foreground">{description}</p> : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </td>
    </tr>
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
