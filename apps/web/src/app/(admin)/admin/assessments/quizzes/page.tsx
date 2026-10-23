import type { Metadata } from 'next';

import { AssessmentsAdmin } from '@/components/admin/operations-admin';

export const metadata: Metadata = { title: 'Assessments · Quizzes' };

export default function Page() {
  return <AssessmentsAdmin kind="quizzes" />;
}
