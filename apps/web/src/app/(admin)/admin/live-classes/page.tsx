import type { Metadata } from 'next';

import { AdminLiveClasses } from '@/components/admin/admin-live-classes';

export const metadata: Metadata = { title: 'Live classes' };

export default function AdminLiveClassesPage() {
  return <AdminLiveClasses />;
}
