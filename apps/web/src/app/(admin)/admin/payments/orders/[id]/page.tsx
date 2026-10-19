import type { Metadata } from 'next';

import { PaymentOrderDetail } from '@/components/admin/payments-admin';

export const metadata: Metadata = { title: 'Order' };

export default async function AdminPaymentOrderPage({
  params,
}: PageProps<'/admin/payments/orders/[id]'>) {
  const { id } = await params;
  return <PaymentOrderDetail id={id} />;
}
