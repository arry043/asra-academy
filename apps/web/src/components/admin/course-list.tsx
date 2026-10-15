'use client';

import type {
  AdminCourseListItem,
  CourseVisibility,
  Paginated,
  PublicationStatus,
} from '@asra/types';
import { BookOpen, Plus, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDiscount, formatMoney, STATUS_LABELS, VISIBILITY_OPTIONS } from '@/lib/admin/format';
import { formatDateTime } from '@/lib/format';

import { ErrorPanel, InactiveBadge, LoadingPanel, StatusBadge, VisibilityBadge } from './admin-ui';
import { useCourseOptions } from './course-options';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

const PAGE_SIZE = 20;
const ALL = 'all';

interface Filters {
  status: PublicationStatus | typeof ALL;
  visibility: CourseVisibility | typeof ALL;
  categoryId: string;
  classId: string;
  subjectId: string;
}

const NO_FILTERS: Filters = {
  status: ALL,
  visibility: ALL,
  categoryId: ALL,
  classId: ALL,
  subjectId: ALL,
};

export function CourseList() {
  const api = useAdminApi();
  const options = useCourseOptions();
  const [searchText, setSearchText] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (query) params.set('q', query);
  for (const [key, value] of Object.entries(filters)) if (value !== ALL) params.set(key, value);
  const path = `/admin/courses?${params.toString()}`;
  const list = useApiResource(path, () => api.get<Paginated<AdminCourseListItem>>(path));

  const isFiltered = query !== '' || Object.values(filters).some((value) => value !== ALL);
  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clear = () => {
    setSearchText('');
    setQuery('');
    setFilters(NO_FILTERS);
    setPage(1);
  };

  const opts = options.data;
  const filterSelects: {
    key: keyof Filters;
    label: string;
    items: { value: string; label: string }[];
  }[] = [
    {
      key: 'status',
      label: 'Status',
      items: (Object.keys(STATUS_LABELS) as PublicationStatus[]).map((value) => ({
        value,
        label: STATUS_LABELS[value],
      })),
    },
    {
      key: 'visibility',
      label: 'Visibility',
      items: (Object.keys(VISIBILITY_OPTIONS) as CourseVisibility[]).map((value) => ({
        value,
        label: VISIBILITY_OPTIONS[value].label,
      })),
    },
    {
      key: 'categoryId',
      label: 'Category',
      items: (opts?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'classId',
      label: 'Class',
      items: (opts?.classes ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'subjectId',
      label: 'Subject',
      items: (opts?.subjects ?? []).map((s) => ({ value: s.id, label: s.name })),
    },
  ];

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Courses"
        description="Create courses, assign faculty, build the curriculum and publish when ready."
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Courses' }]}
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus aria-hidden /> New course
            </Link>
          </Button>
        }
      />

      <form
        role="search"
        aria-label="Search and filter courses"
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-4 rounded-xl border bg-card p-4 shadow-card"
      >
        <div className="grid gap-2">
          <Label htmlFor="course-search">Search</Label>
          <SearchInput
            id="course-search"
            value={searchText}
            maxLength={100}
            placeholder="Title, slug or summary"
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {filterSelects.map((filter) => (
            <div key={filter.key} className="grid gap-2">
              <Label htmlFor={`course-filter-${filter.key}`}>{filter.label}</Label>
              <Select
                value={filters[filter.key]}
                onValueChange={(value) => setFilter(filter.key, value)}
              >
                <SelectTrigger id={`course-filter-${filter.key}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {filter.items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {options.error ? (
          <p className="type-caption text-destructive">
            Filter options could not be loaded: {errorMessage(options.error)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p role="status" aria-live="polite" className="type-body-sm text-muted-foreground">
            {list.data
              ? `${list.data.pagination.total} ${list.data.pagination.total === 1 ? 'course' : 'courses'}${isFiltered ? ' match' : ''}`
              : 'Loading courses…'}
          </p>
          {isFiltered ? (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </form>

      {list.error ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading courses…" rows={6} />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Courses">
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Class &amp; subject</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={8}
                  title={isFiltered ? 'No courses match' : 'No courses yet'}
                  description={
                    isFiltered
                      ? 'Try a different search or clear the filters.'
                      : 'Create the first course. It stays a private draft until you publish it.'
                  }
                  action={
                    isFiltered ? (
                      <Button variant="ghost" size="sm" onClick={clear}>
                        <X aria-hidden /> Clear filters
                      </Button>
                    ) : (
                      <Button asChild size="sm">
                        <Link href="/admin/courses/new">
                          <Plus aria-hidden /> New course
                        </Link>
                      </Button>
                    )
                  }
                />
              ) : (
                items.map((course) => <CourseRow key={course.id} course={course} />)
              )}
            </TableBody>
          </Table>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Course pages"
            />
          ) : null}
        </div>
      )}
    </>
  );
}

function CourseRow({ course }: { course: AdminCourseListItem }) {
  const price = formatMoney(course.priceMinor, course.currency);
  const discount = formatDiscount(course.discountType, course.discountValue, course.currency);
  const primary = course.instructors.find((item) => item.isPrimary) ?? course.instructors[0];

  return (
    <TableRow>
      <TableCell className="min-w-64">
        <Link
          href={`/admin/courses/${course.id}`}
          className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-asra-green-50 text-asra-green-700">
            {course.thumbnailUrl ? (
              // Administrator-supplied external URL; decorative next to the title.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnailUrl}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <BookOpen className="size-5" aria-hidden />
            )}
          </span>
          <span className="grid min-w-0">
            <span className="truncate font-medium text-heading group-hover:text-primary group-hover:underline">
              {course.title}
            </span>
            <span className="truncate type-caption text-muted-foreground">/{course.slug}</span>
          </span>
        </Link>
      </TableCell>
      <TableCell>
        {[course.class?.name, course.stream?.name, course.subject?.name]
          .filter(Boolean)
          .join(' · ') || '—'}
      </TableCell>
      <TableCell>
        {primary ? (
          <span className="grid">
            <span>{primary.fullName}</span>
            {course.instructors.length > 1 ? (
              <span className="type-caption text-muted-foreground">
                +{course.instructors.length - 1} more
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not assigned</span>
        )}
      </TableCell>
      <TableCell>
        {course.category ? (
          <span className="inline-flex items-center gap-1.5">
            {course.category.name}
            {course.category.isActive ? null : <InactiveBadge />}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {price ?? <span className="text-muted-foreground">Not set</span>}
        {discount ? (
          <span className="block type-caption text-muted-foreground">{discount}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusBadge status={course.status} />
      </TableCell>
      <TableCell>
        <VisibilityBadge visibility={course.visibility} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(course.updatedAt)}
      </TableCell>
    </TableRow>
  );
}
