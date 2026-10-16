import type { Metadata } from 'next';

import { ClassesPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Classes' };

export default function StudentClassesPage() {
  return <ClassesPage />;
}
