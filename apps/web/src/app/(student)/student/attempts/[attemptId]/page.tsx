import type { Metadata } from 'next';

import { AttemptPlayer } from '@/components/student/attempt-player';

export const metadata: Metadata = { title: 'Attempt' };

export default async function StudentAttemptRoute({
  params,
}: PageProps<'/student/attempts/[attemptId]'>) {
  const { attemptId } = await params;
  return <AttemptPlayer attemptId={attemptId} />;
}
