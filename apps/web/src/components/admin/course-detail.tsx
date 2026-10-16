'use client';

import { PERMISSIONS, type AdminCourseDetail } from '@asra/types';
import { BookOpen, ClipboardCheck, PencilLine, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiClientError } from '@/lib/api';

import { ErrorPanel, LoadingPanel, StatusBadge, VisibilityBadge } from './admin-ui';
import { FacultyPanel } from './course-faculty';
import { EnrollmentsPanel } from './course-enrollments';
import { CourseForm } from './course-form';
import { PublishingPanel } from './course-publishing';
import { CurriculumEditor } from './curriculum-editor';
import { errorMessage, hasPermission, useAdminApi, useApiResource } from './use-admin';

type Tab = 'overview' | 'details' | 'faculty' | 'curriculum' | 'enrollments';

/** One course: publishing, details, faculty, curriculum and enrolments, each saved independently. */
export function CourseDetail({ id }: { id: string }) {
  const api = useAdminApi();
  const { user } = useAuth();
  const canManageEnrollments = hasPermission(user, PERMISSIONS.ENROLLMENTS_MANAGE);
  const path = `/admin/courses/${id}`;
  const course = useApiResource(path, () => api.get<AdminCourseDetail>(path));
  const [tab, setTab] = React.useState<Tab>('overview');

  if (course.error && !course.data) {
    const missing =
      course.error instanceof ApiClientError &&
      (course.error.status === 404 || course.error.status === 422);
    return (
      <>
        <PageHeader
          title={missing ? 'Course not found' : 'Course'}
          breadcrumbs={[
            { label: 'Administration', href: '/admin' },
            { label: 'Courses', href: '/admin/courses' },
            { label: 'Not found' },
          ]}
        />
        {missing ? (
          <div className="grid justify-items-start gap-3">
            <p className="type-body text-muted-foreground">
              This course does not exist or was deleted.
            </p>
            <Button asChild variant="outline">
              <Link href="/admin/courses">Back to courses</Link>
            </Button>
          </div>
        ) : (
          <ErrorPanel message={errorMessage(course.error)} onRetry={course.reload} />
        )}
      </>
    );
  }
  if (!course.data) return <LoadingPanel label="Loading course…" rows={6} />;

  const data = course.data;

  return (
    <>
      <PageHeader
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <VisibilityBadge visibility={data.visibility} />
            <span className="type-caption">/{data.slug}</span>
          </span>
        }
        breadcrumbs={[
          { label: 'Administration', href: '/admin' },
          { label: 'Courses', href: '/admin/courses' },
          { label: data.title },
        ]}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList aria-label="Course sections">
          <TabsTrigger value="overview">
            <ClipboardCheck aria-hidden /> Publishing
          </TabsTrigger>
          <TabsTrigger value="details">
            <PencilLine aria-hidden /> Details
          </TabsTrigger>
          <TabsTrigger value="faculty">
            <Users aria-hidden /> Faculty
          </TabsTrigger>
          <TabsTrigger value="curriculum">
            <BookOpen aria-hidden /> Curriculum
          </TabsTrigger>
          {canManageEnrollments ? (
            <TabsTrigger value="enrollments">
              <UserCheck aria-hidden /> Enrolments
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="overview">
          <PublishingPanel
            course={data}
            onChanged={course.replace}
            onShowTab={(next) => setTab(next as Tab)}
          />
        </TabsContent>
        <TabsContent value="details">
          <CourseForm course={data} onSaved={course.replace} />
        </TabsContent>
        <TabsContent value="faculty">
          <FacultyPanel key={data.updatedAt} course={data} onChanged={course.replace} />
        </TabsContent>
        <TabsContent value="curriculum">
          {/* Curriculum changes alter the counts and the publication checklist: reload the course. */}
          <CurriculumEditor courseId={data.id} onChanged={course.reload} />
        </TabsContent>
        {canManageEnrollments ? (
          <TabsContent value="enrollments">
            <EnrollmentsPanel course={data} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
