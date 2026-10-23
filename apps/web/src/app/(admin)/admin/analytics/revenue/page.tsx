import type { Metadata } from 'next';

import { RevenueReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Revenue' };

export default function Page() {
  return <RevenueReport />;
}
