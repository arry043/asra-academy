import type { Metadata } from 'next';

import { HistoryPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Learning history' };

export default function StudentHistoryPage() {
  return <HistoryPage />;
}
