import type { Metadata } from 'next';

import { AuditLogAdmin } from '@/components/admin/operations-admin';

export const metadata: Metadata = { title: 'Audit logs' };

export default function Page() {
  return <AuditLogAdmin />;
}
