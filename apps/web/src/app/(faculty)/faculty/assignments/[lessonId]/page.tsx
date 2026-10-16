import type { Metadata } from 'next';

import { AssignmentDetail } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Assignment' };

export default async function FacultyAssignmentPage({
  params,
}: PageProps<'/faculty/assignments/[lessonId]'>) {
  const { lessonId } = await params;
  return <AssignmentDetail lessonId={lessonId} />;
}
