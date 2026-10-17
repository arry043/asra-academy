import type { Metadata } from 'next';

import { ExamWorkspace } from '@/components/faculty/faculty-exams';

export const metadata: Metadata = { title: 'Exam' };

export default async function FacultyExamPage({ params }: PageProps<'/faculty/exams/[examId]'>) {
  const { examId } = await params;
  return <ExamWorkspace examId={examId} />;
}
