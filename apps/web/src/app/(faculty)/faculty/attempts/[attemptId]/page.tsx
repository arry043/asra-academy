import type { Metadata } from 'next';

import { AttemptReview } from '@/components/faculty/attempt-review';

export const metadata: Metadata = { title: 'Review attempt' };

export default async function FacultyAttemptPage({
  params,
}: PageProps<'/faculty/attempts/[attemptId]'>) {
  const { attemptId } = await params;
  return <AttemptReview attemptId={attemptId} />;
}
