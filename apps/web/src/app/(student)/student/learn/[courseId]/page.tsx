import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CoursePlayer } from '@/components/student/course-player';
import { LoadingPanel } from '@/components/student/student-ui';

export const metadata: Metadata = { title: 'Learn' };

export default async function StudentLearnPage({ params }: PageProps<'/student/learn/[courseId]'>) {
  const { courseId } = await params;
  // CoursePlayer reads `?lesson=` (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingPanel label="Loading course…" rows={6} />}>
      <CoursePlayer courseId={courseId} />
    </Suspense>
  );
}
