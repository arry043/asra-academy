'use client';

import type { AnalyticsGranularity, Paginated } from '@asra/types';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Inbox, Minus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/public/empty-state';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, SearchInput } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  presetRange,
  RANGE_PRESETS,
  type Delta,
  type RangeFilter,
  type RangePreset,
} from '@/lib/admin/analytics';
import { isActivePath } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { ErrorPanel, LoadingPanel, SelectField } from './admin-ui';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

/**
 * Shared building blocks of the PHASE 12 admin pages: server-paginated lists, search, KPI cards
 * and the analytics date filter. Lists never load more than one page into the browser.
 */

/**
 * One page of `base` with `params`. Changing any filter starts again at page 1 (the page belongs
 * to one set of filters).
 */
export function usePagedList<T>(
  base: string | null,
  params: Record<string, string | undefined>,
  pageSize = 20,
) {
  const api = useAdminApi();
  const filters = JSON.stringify(params);
  const [paging, setPaging] = React.useState({ filters, page: 1 });
  const page = paging.filters === filters ? paging.page : 1;
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const path = base ? `${base}?${query.toString()}` : null;
  const list = useApiResource(path, () => api.get<Paginated<T>>(path!));
  return { list, setPage: (next: number) => setPaging({ filters, page: next }) };
}

export function ListFrame<T>({
  list,
  setPage,
  label,
  emptyTitle,
  emptyText = 'Nothing matches these filters.',
  icon = <Inbox />,
  children,
}: {
  list: ReturnType<typeof usePagedList<T>>['list'];
  setPage: (page: number) => void;
  label: string;
  emptyTitle?: string;
  emptyText?: React.ReactNode;
  icon?: React.ReactNode;
  children: (items: T[]) => React.ReactNode;
}) {
  if (list.error && !list.data)
    return <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />;
  if (!list.data) return <LoadingPanel />;
  if (list.data.items.length === 0) {
    return <EmptyState icon={icon} title={emptyTitle ?? `No ${label}`} description={emptyText} />;
  }
  const { page, pageCount, total } = list.data.pagination;
  return (
    <div className="grid gap-4" aria-busy={list.loading || undefined}>
      <div className="overflow-x-auto rounded-xl border bg-card">{children(list.data.items)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-caption text-muted-foreground">
          {total} {label}
        </p>
        {pageCount > 1 ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            label={`${label} pages`}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Search box that applies on submit (one request per search, not per keystroke). */
export function SearchBox({
  id,
  placeholder,
  onSearch,
  label = 'Search',
}: {
  id: string;
  placeholder: string;
  onSearch: (q: string) => void;
  label?: string;
}) {
  const [text, setText] = React.useState('');
  return (
    <form
      role="search"
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchInput
        id={id}
        placeholder={placeholder}
        value={text}
        maxLength={100}
        onChange={(event) => setText(event.target.value)}
        className="w-64"
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
}

/** Filter select with an "All" option mapped to "". */
export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <div className="w-48">
      <SelectField
        id={id}
        label={label}
        value={value || 'ALL'}
        onValueChange={(next) => onChange(next === 'ALL' ? '' : next)}
        options={[{ value: 'ALL', label: allLabel }, ...options]}
      />
    </div>
  );
}

export function DeltaBadge({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className="inline-flex items-center gap-1 type-caption text-muted-foreground"
      title={delta.description}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="text-foreground tabular-nums">{delta.text}</span>
      <span className="sr-only">{delta.description}</span>
    </span>
  );
}

/** KPI tile: title, the computed value, icon, definition and an optional link. */
export function KpiCard({
  title,
  value,
  icon,
  hint,
  href,
  delta,
  deltaLabel,
}: {
  title: string;
  value: React.ReactNode | undefined;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  delta?: Delta;
  deltaLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <dt className="type-caption text-muted-foreground">{title}</dt>
        {icon ? (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-asra-green-700 dark:text-asra-gold-500 [&_svg]:size-[1.125rem]"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <dd className="type-h2 text-heading tabular-nums">
        {value === undefined ? <Skeleton className="h-8 w-16" /> : value}
      </dd>
      {hint ? <dd className="type-caption text-muted-foreground">{hint}</dd> : null}
      {delta ? (
        <dd className="flex flex-wrap items-center gap-1.5">
          <DeltaBadge delta={delta} />
          {deltaLabel ? (
            <span className="type-caption text-muted-foreground">{deltaLabel}</span>
          ) : null}
        </dd>
      ) : null}
    </>
  );
  const className = 'grid content-start gap-1.5 rounded-xl border bg-card p-5 shadow-card';
  return href ? (
    <div
      className={cn(
        className,
        'relative transition-shadow focus-within:ring-[3px] focus-within:ring-ring/50 hover:shadow-raised',
      )}
    >
      {body}
      <Link
        href={href}
        className="absolute inset-0 rounded-xl outline-none"
        aria-label={`${title}: open`}
      />
    </div>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A titled card section with an optional "View all" link. */
export function Section({
  title,
  description,
  href,
  hrefLabel = 'View all',
  children,
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'grid content-start gap-4 rounded-xl border bg-card p-5 shadow-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 className="type-h4 text-heading">{title}</h2>
          {description ? <p className="type-caption text-muted-foreground">{description}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 type-label text-primary hover:underline"
          >
            {hrefLabel} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Date range for analytics: presets, a custom from/to (calendar days in IST, inclusive) and the
 * grouping. Empty grouping lets the server choose (day ≤ 62 days, week ≤ 1 year, else month).
 * `allowAllTime` adds "All time" (no range) for reports that default to it.
 */
export function DateRangeFilter({
  value,
  onChange,
  allowAllTime = false,
  showGranularity = true,
}: {
  value: RangeFilter;
  onChange: (value: RangeFilter) => void;
  allowAllTime?: boolean;
  showGranularity?: boolean;
}) {
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const preset =
    value.from === '' && value.to === ''
      ? 'all'
      : (RANGE_PRESETS.find((p) => {
          const range = presetRange(p.value);
          return range.from === value.from && range.to === value.to;
        })?.value ?? 'custom');

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.from || !draft.to) return setError('Choose both dates.');
    if (draft.from > draft.to) return setError('"From" must not be after "to".');
    setError(null);
    onChange(draft);
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <SelectField
            id="range-preset"
            label="Period"
            value={preset}
            onValueChange={(next) => {
              if (next === 'custom') return;
              const range =
                next === 'all'
                  ? { from: '', to: '', granularity: '' as const }
                  : presetRange(next as RangePreset);
              setDraft(range);
              setError(null);
              onChange(range);
            }}
            options={[
              ...(allowAllTime ? [{ value: 'all', label: 'All time' }] : []),
              ...RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label })),
              { value: 'custom', label: 'Custom range', disabled: true },
            ]}
          />
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={apply} noValidate>
          <Field id="range-from" label="From">
            <Input
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
          </Field>
          <Field id="range-to" label="To">
            <Input
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
        {showGranularity && value.from ? (
          <div className="w-40">
            <SelectField
              id="range-granularity"
              label="Group by"
              value={value.granularity || 'auto'}
              onValueChange={(next) =>
                onChange({
                  ...value,
                  granularity: next === 'auto' ? '' : (next as AnalyticsGranularity),
                })
              }
              options={[
                { value: 'auto', label: 'Automatic' },
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="type-caption text-destructive">
          {error}
        </p>
      ) : (
        <p className="type-caption text-muted-foreground">
          Calendar days in India Standard Time (Asia/Kolkata), both dates included.
        </p>
      )}
    </div>
  );
}

/**
 * Route-based tabs (each tab is its own URL, so it can be bookmarked and the back button works).
 * Styled like the Radix tabs list.
 */
export function SubNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="inline-flex max-w-full [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-full px-4 type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? 'bg-card text-heading shadow-card'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
