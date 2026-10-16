import type { Metadata } from 'next';

import { ResultsPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Results' };

export default function StudentResultsPage() {
  return <ResultsPage />;
}
