import type { Metadata } from 'next';

import { ExamsPage } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Exams' };

export default function FacultyExamsPage() {
  return <ExamsPage />;
}
