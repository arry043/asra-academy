import type { Metadata } from 'next';

import { UserDetail } from '@/components/admin/users-admin';

export const metadata: Metadata = { title: 'Account' };

export default async function Page({ params }: PageProps<'/admin/users/[id]'>) {
  const { id } = await params;
  return <UserDetail id={id} />;
}
