import type { Metadata } from 'next';

import { QuizzesPage } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Quizzes' };

export default function FacultyQuizzesPage() {
  return <QuizzesPage />;
}
