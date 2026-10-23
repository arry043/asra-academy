import type { Metadata } from 'next';

import { EmailDeliveriesAdmin } from '@/components/admin/operations-admin';

export const metadata: Metadata = { title: 'Email delivery' };

export default function Page() {
  return <EmailDeliveriesAdmin />;
}
