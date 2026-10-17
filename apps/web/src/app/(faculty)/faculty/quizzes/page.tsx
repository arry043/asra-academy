import type { Metadata } from 'next';

import { QuizzesPage } from '@/components/faculty/faculty-quizzes';

export const metadata: Metadata = { title: 'Quizzes' };

export default function FacultyQuizzesPage() {
  return <QuizzesPage />;
}
