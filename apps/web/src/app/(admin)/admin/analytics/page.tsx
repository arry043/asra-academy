import type { Metadata } from 'next';

import { StudentGrowthReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Student growth' };

export default function Page() {
  return <StudentGrowthReport />;
}
