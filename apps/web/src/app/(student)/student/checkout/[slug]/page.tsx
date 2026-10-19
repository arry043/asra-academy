import type { Metadata } from 'next';

import { Checkout } from '@/components/student/checkout';

export const metadata: Metadata = { title: 'Checkout' };

export default async function StudentCheckoutPage({
  params,
}: PageProps<'/student/checkout/[slug]'>) {
  const { slug } = await params;
  return <Checkout slug={slug} />;
}
