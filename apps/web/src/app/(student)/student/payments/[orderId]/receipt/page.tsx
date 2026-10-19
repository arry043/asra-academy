import type { Metadata } from 'next';

import { PaymentReceipt } from '@/components/student/payment-receipt';

export const metadata: Metadata = { title: 'Payment receipt' };

export default async function StudentReceiptPage({
  params,
}: PageProps<'/student/payments/[orderId]/receipt'>) {
  const { orderId } = await params;
  return <PaymentReceipt orderId={orderId} />;
}
