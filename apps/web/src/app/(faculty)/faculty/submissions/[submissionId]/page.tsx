import type { Metadata } from 'next';

import { SubmissionReview } from '@/components/faculty/faculty-assessments';

export const metadata: Metadata = { title: 'Review submission' };

export default async function FacultySubmissionPage({
  params,
}: PageProps<'/faculty/submissions/[submissionId]'>) {
  const { submissionId } = await params;
  return <SubmissionReview id={submissionId} />;
}
