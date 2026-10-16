import type { Metadata } from 'next';

import { ExamsPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Exams' };

export default function StudentExamsPage() {
  return <ExamsPage />;
}
