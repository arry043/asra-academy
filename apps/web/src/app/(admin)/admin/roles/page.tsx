import type { Metadata } from 'next';

import { RolesAdmin } from '@/components/admin/operations-admin';

export const metadata: Metadata = { title: 'Roles and permissions' };

export default function Page() {
  return <RolesAdmin />;
}
