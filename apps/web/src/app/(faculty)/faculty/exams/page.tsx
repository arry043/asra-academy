import type { Metadata } from 'next';

import { ExamsPage } from '@/components/faculty/faculty-exams';

export const metadata: Metadata = { title: 'Exams' };

export default function FacultyExamsPage() {
  return <ExamsPage />;
}
