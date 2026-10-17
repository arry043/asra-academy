'use client';

import type { FacultyCourseCard, LiveClassDto, Paginated, SubmissionListItem } from '@asra/types';
import { Ban, CalendarClock, CheckCircle2, Clock, Hourglass, Send } from 'lucide-react';
import * as React from 'react';

import { SelectField } from '@/components/admin/admin-ui';
import { errorMessage, useApiResource } from '@/components/admin/use-admin';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  CLASS_TIMING_LABELS,
  classTiming,
  REVIEW_STATE_BADGE,
  REVIEW_STATE_LABELS,
  reviewState,
} from '@/lib/faculty/portal';

export { ErrorPanel, LoadingPanel, StatusBadge } from '@/components/admin/admin-ui';
export { errorMessage, useApiResource };

/**
 * Data access for the faculty portal: the same thin layer over `authorizedRequest` as the admin
 * and student portals. The API decides what the faculty member may see and change.
 */
export function useFacultyApi() {
  const { authorizedRequest } = useAuth();
  return React.useMemo(
    () => ({
      get: <T,>(path: string) => authorizedRequest<T>(path),
      post: <T,>(path: string, body?: unknown) =>
        authorizedRequest<T>(path, { method: 'POST', ...(body === undefined ? {} : { body }) }),
      put: <T,>(path: string, body: unknown) => authorizedRequest<T>(path, { method: 'PUT', body }),
      patch: <T,>(path: string, body: unknown) =>
        authorizedRequest<T>(path, { method: 'PATCH', body }),
      del: <T,>(path: string) => authorizedRequest<T>(path, { method: 'DELETE' }),
    }),
    [authorizedRequest],
  );
}

export type FacultyApi = ReturnType<typeof useFacultyApi>;

/** `?page=` + filters, dropping empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** The faculty member's assigned courses, for filters and pickers (max 100). */
export function useMyCourses() {
  const api = useFacultyApi();
  const path = '/faculty/courses?pageSize=100';
  return useApiResource(path, () => api.get<Paginated<FacultyCourseCard>>(path));
}

/** "All my courses" + each assigned course. */
export function CourseFilter({
  id,
  value,
  onChange,
  allLabel = 'All my courses',
  label = 'Course',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string | null;
  label?: string;
}) {
  const courses = useMyCourses();
  const options = [
    ...(allLabel ? [{ value: 'all', label: allLabel }] : []),
    ...(courses.data?.items ?? []).map((course) => ({ value: course.id, label: course.title })),
  ];
  return (
    <SelectField
      id={id}
      label={label}
      value={value || (allLabel ? 'all' : '')}
      onValueChange={(next) => onChange(next === 'all' ? '' : next)}
      options={options}
      disabled={!courses.data}
      placeholder={courses.error ? errorMessage(courses.error) : 'Choose a course'}
    />
  );
}

export function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="flex-row items-center gap-4">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="grid">
        <span className="type-h2 text-heading tabular-nums">{value}</span>
        <span className="type-body-sm text-muted-foreground">{label}</span>
        {hint ? <span className="type-caption text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}

const REVIEW_ICONS = { AWAITING_REVIEW: Hourglass, GRADED: CheckCircle2, RELEASED: Send } as const;

export function ReviewBadge({
  item,
}: {
  item: Pick<SubmissionListItem, 'status' | 'resultReleasedAt'>;
}) {
  const state = reviewState(item);
  const Icon = REVIEW_ICONS[state];
  return (
    <Badge variant={REVIEW_STATE_BADGE[state]}>
      <Icon aria-hidden />
      {REVIEW_STATE_LABELS[state]}
    </Badge>
  );
}

export function LateBadge() {
  return (
    <Badge variant="warning">
      <Clock aria-hidden /> Late
    </Badge>
  );
}

const TIMING_ICONS = { cancelled: Ban, scheduled: CalendarClock, ended: CheckCircle2 } as const;
const TIMING_BADGE = { cancelled: 'destructive', scheduled: 'info', ended: 'secondary' } as const;

export function ClassBadge({ item }: { item: Pick<LiveClassDto, 'status' | 'endsAt'> }) {
  const timing = classTiming(item);
  const Icon = TIMING_ICONS[timing];
  return (
    <Badge variant={TIMING_BADGE[timing]}>
      <Icon aria-hidden />
      {CLASS_TIMING_LABELS[timing]}
    </Badge>
  );
}
