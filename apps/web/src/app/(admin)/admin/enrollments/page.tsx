import type { Metadata } from 'next';

import { EnrollmentsAdmin } from '@/components/admin/operations-admin';

export const metadata: Metadata = { title: 'Enrolments' };

export default function Page() {
  return <EnrollmentsAdmin />;
}
