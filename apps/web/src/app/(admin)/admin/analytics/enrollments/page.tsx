import type { Metadata } from 'next';

import { EnrollmentsReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Enrolments' };

export default function Page() {
  return <EnrollmentsReport />;
}
