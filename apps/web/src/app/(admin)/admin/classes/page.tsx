import type { Metadata } from 'next';

import { ClassesManager } from '@/components/admin/catalogue-configs';

export const metadata: Metadata = { title: 'Classes' };

export default function Page() {
  return <ClassesManager />;
}
