import type { Metadata } from 'next';

import { AssessmentLessonsPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Assignments' };

export default function StudentAssignmentsPage() {
  return <AssessmentLessonsPage kind="ASSIGNMENT" />;
}
