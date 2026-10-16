import type { Metadata } from 'next';

import { AssessmentLessonsPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Quizzes' };

export default function StudentQuizzesPage() {
  return <AssessmentLessonsPage kind="QUIZ" />;
}
