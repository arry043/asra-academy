import type { Metadata } from 'next';

import { UserDirectory } from '@/components/admin/users-admin';

export const metadata: Metadata = { title: 'Administrators' };

export default function Page() {
  return <UserDirectory role="ADMIN" />;
}
