import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FacultyCourseWorkspace } from '@/components/faculty/faculty-course';
import { LoadingPanel } from '@/components/faculty/faculty-ui';

export const metadata: Metadata = { title: 'Course' };

export default async function FacultyCoursePage({
  params,
}: PageProps<'/faculty/courses/[courseId]'>) {
  const { courseId } = await params;
  // The workspace reads `?tab=` (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingPanel label="Loading course…" rows={6} />}>
      <FacultyCourseWorkspace courseId={courseId} />
    </Suspense>
  );
}
