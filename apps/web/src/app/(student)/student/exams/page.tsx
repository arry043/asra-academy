import type { Metadata } from 'next';

import { StudentExamsPage } from '@/components/student/assessment-pages';

export const metadata: Metadata = { title: 'Exams' };

export default function StudentExamsRoute() {
  return <StudentExamsPage />;
}
