import type { Metadata } from 'next';

import { StudentExamDetailPage } from '@/components/student/assessment-pages';

export const metadata: Metadata = { title: 'Exam' };

export default async function StudentExamRoute({ params }: PageProps<'/student/exams/[examId]'>) {
  const { examId } = await params;
  return <StudentExamDetailPage examId={examId} />;
}
