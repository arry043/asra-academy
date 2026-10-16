import type { Metadata } from 'next';

import { SubmissionsPage } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Submissions' };

export default function FacultySubmissionsPage() {
  return <SubmissionsPage />;
}
