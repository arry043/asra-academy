import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoadingPanel } from '@/components/student/student-ui';
import { StudentCourses } from '@/components/student/student-courses';

export const metadata: Metadata = { title: 'My courses' };

export default function StudentCoursesPage() {
  // StudentCourses reads `?tab=` (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingPanel label="Loading your courses…" />}>
      <StudentCourses />
    </Suspense>
  );
}
