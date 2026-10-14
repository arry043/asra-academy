'use client';

import { Progress as ProgressPrimitive } from 'radix-ui';
import * as React from 'react';

import { clampProgress, cn, toPercent } from '@/lib/utils';

type ProgressProps = {
  /** Current value. Missing/invalid values render an indeterminate-free empty bar marked "No data". */
  value: number | null | undefined;
  max?: number;
  /** Accessible name, e.g. "Course completion". Required: a bar without a name is meaningless. */
  label: string;
  /** Show the label and percentage as visible text above the bar. */
  showValue?: boolean;
  size?: 'sm' | 'default';
  className?: string;
};

/**
 * Determinate progress bar (Radix `role="progressbar"` with aria-valuenow/min/max). Values are
 * clamped to 0…max. The percentage is always available as text, so progress is never conveyed by
 * colour or bar length alone.
 */
function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'default',
  className,
}: ProgressProps) {
  const clamped = clampProgress(value, max);
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percent = clamped === null ? null : toPercent(clamped, safeMax);
  const valueText = percent === null ? 'No progress data' : `${percent}%`;
  const complete = percent === 100;

  return (
    <div data-slot="progress" className={cn('grid gap-1.5', className)}>
      {showValue ? (
        <div className="flex items-baseline justify-between gap-3 type-caption">
          <span className="font-medium text-foreground">{label}</span>
          <span
            className={cn(
              'tabular-nums',
              complete ? 'font-semibold text-success' : 'text-muted-foreground',
            )}
          >
            {valueText}
          </span>
        </div>
      ) : null}
      {clamped === null ? (
        // Not a progressbar: Radix would announce a null value as "indeterminate" (busy).
        <>
          <div
            aria-hidden
            className={cn('w-full rounded-full bg-muted', size === 'sm' ? 'h-1.5' : 'h-2.5')}
          />
          {showValue ? null : <span className="sr-only">{`${label}: ${valueText}`}</span>}
        </>
      ) : (
        <ProgressPrimitive.Root
          value={clamped}
          max={safeMax}
          aria-label={label}
          getValueLabel={() => valueText}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-asra-green-100',
            size === 'sm' ? 'h-1.5' : 'h-2.5',
          )}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              'h-full rounded-full transition-[width] duration-500 ease-standard',
              complete ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${percent ?? 0}%` }}
          />
        </ProgressPrimitive.Root>
      )}
    </div>
  );
}

export { Progress, type ProgressProps };
