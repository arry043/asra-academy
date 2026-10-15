'use client';

import { PERMISSIONS, type Paginated } from '@asra/types';
import { BookOpen, GraduationCap, Plus, Shapes } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { ErrorPanel } from './admin-ui';
import { errorMessage, hasPermission, useAdminApi, useApiResource } from './use-admin';

const total = (page: Paginated<unknown>) => page.pagination.total;

/** Real counts from the API (no placeholder metrics) and shortcuts to the main tasks. */
export function AdminOverview() {
  const { user } = useAuth();
  const api = useAdminApi();
  const canCourses = hasPermission(user, PERMISSIONS.COURSES_MANAGE);
  const canAcademics = hasPermission(user, PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE);

  const counts = useApiResource(canCourses ? 'overview-counts' : null, async () => {
    const [all, published, draft, categories] = await Promise.all([
      api.get<Paginated<unknown>>('/admin/courses?pageSize=1'),
      api.get<Paginated<unknown>>('/admin/courses?pageSize=1&status=PUBLISHED'),
      api.get<Paginated<unknown>>('/admin/courses?pageSize=1&status=DRAFT'),
      api.get<Paginated<unknown>>('/admin/course-categories?pageSize=1'),
    ]);
    return {
      all: total(all),
      published: total(published),
      draft: total(draft),
      categories: total(categories),
    };
  });

  const stats = counts.data
    ? [
        { label: 'Courses', value: counts.data.all },
        { label: 'Published', value: counts.data.published },
        { label: 'Drafts', value: counts.data.draft },
        { label: 'Categories', value: counts.data.categories },
      ]
    : null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName.split(' ')[0] ?? 'admin'}`}
        description="Manage the academic structure, courses and their curriculum."
        actions={
          canCourses ? (
            <Button asChild>
              <Link href="/admin/courses/new">
                <Plus aria-hidden /> New course
              </Link>
            </Button>
          ) : null
        }
      />

      {canCourses ? (
        counts.error ? (
          <ErrorPanel message={errorMessage(counts.error)} onRetry={counts.reload} />
        ) : (
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy={!stats || undefined}>
            {(
              stats ?? [
                { label: 'Courses' },
                { label: 'Published' },
                { label: 'Drafts' },
                { label: 'Categories' },
              ]
            ).map((stat) => (
              <div
                key={stat.label}
                className="grid gap-1 rounded-xl border bg-card p-5 shadow-card"
              >
                <dt className="type-caption text-muted-foreground">{stat.label}</dt>
                <dd className="type-h2 text-heading tabular-nums">
                  {'value' in stat ? stat.value : <Skeleton className="h-8 w-12" />}
                </dd>
              </div>
            ))}
          </dl>
        )
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {canAcademics ? (
          <Shortcut
            href="/admin/classes"
            icon={<GraduationCap />}
            title="Academic structure"
            text="Academic levels, classes, streams and subjects."
          />
        ) : null}
        {canCourses ? (
          <>
            <Shortcut
              href="/admin/course-categories"
              icon={<Shapes />}
              title="Course categories"
              text="Group courses in the catalogue."
            />
            <Shortcut
              href="/admin/courses"
              icon={<BookOpen />}
              title="Courses"
              text="Create, assign faculty, build curriculum and publish."
            />
          </>
        ) : null}
      </div>
    </>
  );
}

function Shortcut({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group grid gap-2 rounded-xl border bg-card p-5 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-secondary text-asra-green-700 [&_svg]:size-5"
      >
        {icon}
      </span>
      <span className="type-h4 text-heading group-hover:text-primary">{title}</span>
      <span className="type-body-sm text-muted-foreground">{text}</span>
    </Link>
  );
}
