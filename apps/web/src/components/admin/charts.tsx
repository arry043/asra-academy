'use client';

import type { AnalyticsGranularity } from '@asra/types';
import { Table2, LineChart } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { niceMax, periodLabel } from '@/lib/admin/analytics';
import { cn } from '@/lib/utils';

/**
 * Lightweight, dependency-free charts for the admin analytics (PHASE 12). Every chart plots ONE
 * series in the brand hue (green in light mode, gold in dark — contrast ≥ 3:1 on the card surface)
 * and always offers the exact figures as a table, so nothing depends on colour or hover alone.
 * Data always comes from the API; an empty series renders an explicit empty state.
 */

const CHART_HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface TrendPoint {
  period: string;
  value: number;
}

/**
 * Time series as an area chart with a crosshair + tooltip (pointer and arrow keys) and a table
 * toggle. `format` formats values for the axis, tooltip and table (counts or money).
 */
export function TrendChart({
  title,
  points,
  granularity,
  format,
  emptyText = 'No data in this period.',
}: {
  title: string;
  points: TrendPoint[];
  granularity: AnalyticsGranularity;
  format: (value: number) => string;
  emptyText?: string;
}) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);
  const titleId = React.useId();
  const allZero = points.every((point) => point.value === 0);

  const min = Math.min(0, ...points.map((p) => p.value));
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (index * innerW) / (points.length - 1));
  const y = (value: number) => PAD.top + innerH - ((value - min) / (max - min || 1)) * innerH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = points.length
    ? `${line} L${x(points.length - 1)},${y(Math.max(min, 0))} L${x(0)},${y(Math.max(min, 0))} Z`
    : '';
  const ticks = [min, (min + max) / 2, max].filter((v, i, all) => all.indexOf(v) === i);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 80))));

  function pick(clientX: number, rect: DOMRect) {
    if (points.length === 0) return;
    const relative = clientX - rect.left - PAD.left;
    const index = points.length <= 1 ? 0 : Math.round((relative / innerW) * (points.length - 1));
    setActive(Math.min(points.length - 1, Math.max(0, index)));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (points.length === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setActive((current) =>
        Math.min(
          points.length - 1,
          Math.max(0, (current ?? (delta > 0 ? -1 : points.length)) + delta),
        ),
      );
    } else if (event.key === 'Escape') setActive(null);
  }

  const activePoint = active === null ? null : points[active];

  return (
    <figure className="grid gap-3" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2">
        <figcaption id={titleId} className="type-h4 text-heading">
          {title}
        </figcaption>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          aria-pressed={view === 'table'}
        >
          {view === 'chart' ? <Table2 aria-hidden /> : <LineChart aria-hidden />}
          {view === 'chart' ? 'Show table' : 'Show chart'}
        </Button>
      </div>

      {view === 'table' ? (
        <div className="max-h-72 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.period}>
                  <TableCell>{periodLabel(point.period, granularity, true)}</TableCell>
                  <TableCell className="text-right tabular-nums">{format(point.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : allZero ? (
        <p className="grid h-[220px] place-items-center rounded-lg border border-dashed type-body-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div ref={ref} className="relative">
          {width > 0 ? (
            <svg
              width={width}
              height={CHART_HEIGHT}
              role="img"
              aria-label={`${title}: ${points.length} periods. Use the arrow keys to read values, or show the table.`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerMove={(event) =>
                pick(event.clientX, event.currentTarget.getBoundingClientRect())
              }
              onPointerLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              className="rounded-md text-asra-green-600 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-asra-gold-500"
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="stroke-border"
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {format(tick)}
                  </text>
                </g>
              ))}
              {points.map((point, index) =>
                index % labelEvery === 0 ? (
                  <text
                    key={point.period}
                    x={x(index)}
                    y={CHART_HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {periodLabel(point.period, granularity)}
                  </text>
                ) : null,
              )}
              <path d={area} fill="currentColor" fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {activePoint && active !== null ? (
                <g>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={PAD.top}
                    y2={PAD.top + innerH}
                    className="stroke-muted-foreground"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={x(active)}
                    cy={y(activePoint.value)}
                    r={5}
                    fill="currentColor"
                    className="stroke-card"
                    strokeWidth={2}
                  />
                </g>
              ) : null}
            </svg>
          ) : (
            <div style={{ height: CHART_HEIGHT }} />
          )}
          {activePoint && active !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 grid -translate-x-1/2 gap-0.5 rounded-md border bg-popover px-3 py-2 shadow-raised"
              style={{ left: Math.min(Math.max(x(active), 70), width - 70) }}
            >
              <span className="type-caption text-muted-foreground">
                {periodLabel(activePoint.period, granularity, true)}
              </span>
              <span className="type-label text-heading tabular-nums">
                {format(activePoint.value)}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}

export interface BarItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Secondary text after the value, e.g. "1 still active". */
  note?: string;
}

/**
 * Ranked horizontal bars — for comparisons between courses, classes, sources. Every bar is
 * labelled with its exact value, so the figure never depends on reading bar length.
 */
export function BarList({
  title,
  items,
  format = String,
  emptyText = 'Nothing to compare in this period.',
}: {
  title: string;
  items: BarItem[];
  format?: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const titleId = React.useId();
  return (
    <figure className="grid gap-3" aria-labelledby={titleId}>
      <figcaption id={titleId} className="type-h4 text-heading">
        {title}
      </figcaption>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center type-body-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ol className="grid gap-2.5">
          {items.map((item) => (
            <li key={item.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 type-body-sm">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="shrink-0 text-heading tabular-nums">
                  {format(item.value)}
                  {item.note ? (
                    <span className="ml-1.5 type-caption text-muted-foreground">{item.note}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted" aria-hidden>
                <div
                  className={cn(
                    'h-2 rounded-full bg-asra-green-600 dark:bg-asra-gold-500',
                    item.value === 0 && 'bg-transparent',
                  )}
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/** Columns for a distribution with ordered bins (e.g. score bands). Values labelled on top. */
export function ColumnChart({
  title,
  columns,
  emptyText = 'No evaluated attempts yet.',
}: {
  title: string;
  columns: { key: string; label: string; value: number }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...columns.map((column) => column.value));
  const titleId = React.useId();
  const empty = columns.every((column) => column.value === 0);
  return (
    <figure className="grid gap-3" aria-labelledby={titleId}>
      <figcaption id={titleId} className="type-h4 text-heading">
        {title}
      </figcaption>
      {empty ? (
        <p className="rounded-lg border border-dashed p-6 text-center type-body-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ol className="flex h-48 items-end gap-1.5 border-b pb-0">
          {columns.map((column) => (
            <li
              key={column.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${column.label}: ${column.value}`}
            >
              <span className="type-caption text-heading tabular-nums">{column.value}</span>
              <span
                aria-hidden
                className="w-full rounded-t-[4px] bg-asra-green-600 dark:bg-asra-gold-500"
                style={{ height: `${(column.value / max) * 75}%`, minHeight: column.value ? 2 : 0 }}
              />
              <span className="sr-only">
                {column.label}: {column.value}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!empty ? (
        <div className="flex gap-1.5" aria-hidden>
          {columns.map((column) => (
            <span
              key={column.key}
              className="flex-1 truncate text-center type-caption text-muted-foreground"
            >
              {column.label}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}
