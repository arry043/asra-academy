import type { Metadata } from 'next';

import { QuizWorkspace } from '@/components/faculty/faculty-quizzes';

export const metadata: Metadata = { title: 'Quiz' };

export default async function FacultyQuizPage({
  params,
}: PageProps<'/faculty/quizzes/[lessonId]'>) {
  const { lessonId } = await params;
  return <QuizWorkspace lessonId={lessonId} />;
}
