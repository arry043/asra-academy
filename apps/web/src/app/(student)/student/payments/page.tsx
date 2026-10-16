import type { Metadata } from 'next';

import { PaymentsPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Payments' };

export default function StudentPaymentsPage() {
  return <PaymentsPage />;
}
