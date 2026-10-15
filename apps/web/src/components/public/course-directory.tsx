'use client';

import { SearchX, X } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/public/empty-state';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/input';
import { PROGRAMME_CATEGORIES, type Programme, type ProgrammeCategory } from '@/content/programmes';
import {
  countByCategory,
  DEFAULT_PROGRAMME_FILTERS,
  filterProgrammes,
  MAX_QUERY_LENGTH,
  parseProgrammeFilters,
  toProgrammeSearchParams,
  type ProgrammeFilters,
} from '@/lib/programmes';
import { cn } from '@/lib/utils';

const CATEGORY_OPTIONS: { value: ProgrammeCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.entries(PROGRAMME_CATEGORIES) as [ProgrammeCategory, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

/**
 * Course directory with search and a category filter. Filtering is local (the catalogue is small
 * and static — no request per keystroke). State is mirrored into the URL (`?q=…&category=…`) with
 * `history.replaceState`, so results can be shared and survive a refresh without adding history
 * entries. Must be rendered inside `<Suspense>` because it reads `useSearchParams`.
 */
export function CourseDirectory({ programmes }: { programmes: Programme[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [filters, setFilters] = React.useState<ProgrammeFilters>(() =>
    parseProgrammeFilters(searchParams),
  );
  const searchId = React.useId();
  const resultsId = React.useId();

  const results = React.useMemo(() => filterProgrammes(programmes, filters), [programmes, filters]);
  const counts = React.useMemo(() => countByCategory(programmes), [programmes]);
  const isFiltered = filters.query.trim() !== '' || filters.category !== 'all';

  function update(next: ProgrammeFilters) {
    setFilters(next);
    const query = toProgrammeSearchParams(next);
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  }

  const categoryLabel = filters.category === 'all' ? null : PROGRAMME_CATEGORIES[filters.category];
  const summary =
    results.length === 0
      ? 'No courses match your search.'
      : `Showing ${results.length} of ${programmes.length} ${programmes.length === 1 ? 'programme' : 'programmes'}` +
        (categoryLabel ? ` in ${categoryLabel}` : '') +
        (filters.query.trim() ? ` for “${filters.query.trim()}”` : '') +
        '.';

  return (
    <div className="grid gap-8">
      <form
        role="search"
        aria-label="Search and filter courses"
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-5 rounded-2xl border bg-card p-4 shadow-card sm:p-6"
      >
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Search courses</Label>
          <SearchInput
            id={searchId}
            name="q"
            value={filters.query}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Try “grammar”, “Tajweed” or “Mathematics”"
            autoComplete="off"
            aria-controls={resultsId}
            onChange={(event) => update({ ...filters, query: event.target.value })}
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 type-label">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const checked = filters.category === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'relative inline-flex min-h-control-sm cursor-pointer items-center gap-2 rounded-full border px-4 type-label transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary',
                  )}
                >
                  <input
                    type="radio"
                    name="category"
                    value={option.value}
                    checked={checked}
                    onChange={() => update({ ...filters, category: option.value })}
                    className="sr-only"
                  />
                  {option.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 type-caption',
                      checked ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {counts[option.value]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p role="status" aria-live="polite" className="type-body-sm text-muted-foreground">
            {summary}
          </p>
          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => update(DEFAULT_PROGRAMME_FILTERS)}
            >
              <X aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </form>

      <div id={resultsId}>
        {results.length > 0 ? (
          <ProgrammeGrid items={results} />
        ) : (
          <EmptyState
            icon={<SearchX />}
            headingLevel="h3"
            title="No matching courses"
            description="Try a different word, choose another category, or clear the filters to see every programme."
            action={
              <Button type="button" onClick={() => update(DEFAULT_PROGRAMME_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
