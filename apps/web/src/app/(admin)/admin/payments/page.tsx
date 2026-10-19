import type { Metadata } from 'next';

import { PaymentsAdmin } from '@/components/admin/payments-admin';

export const metadata: Metadata = { title: 'Payments' };

export default function AdminPaymentsPage() {
  return <PaymentsAdmin />;
}
