import type { Metadata } from 'next';

import { AssignmentsPage } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Assignments' };

export default function FacultyAssignmentsPage() {
  return <AssignmentsPage />;
}
