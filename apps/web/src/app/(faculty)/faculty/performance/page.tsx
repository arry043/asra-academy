import type { Metadata } from 'next';

import { PerformancePage } from '@/components/faculty/faculty-students';

export const metadata: Metadata = { title: 'Performance' };

export default function FacultyPerformancePage() {
  return <PerformancePage />;
}
