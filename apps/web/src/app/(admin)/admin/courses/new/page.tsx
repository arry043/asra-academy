import type { Metadata } from 'next';

import { CourseForm } from '@/components/admin/course-form';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'New course' };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader
        title="New course"
        description="The course is saved as a private draft. Add faculty and curriculum next, then publish."
        breadcrumbs={[
          { label: 'Administration', href: '/admin' },
          { label: 'Courses', href: '/admin/courses' },
          { label: 'New course' },
        ]}
      />
      <CourseForm />
    </>
  );
}
