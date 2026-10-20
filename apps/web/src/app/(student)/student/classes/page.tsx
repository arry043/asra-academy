import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoadingPanel } from '@/components/admin/admin-ui';
import { ClassesPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Classes' };

export default function StudentClassesPage() {
  // ClassesPage reads `?when=` (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingPanel label="Loading classes…" />}>
      <ClassesPage />
    </Suspense>
  );
}
