import type { Metadata } from 'next';

import { FacultyReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Faculty activity' };

export default function Page() {
  return <FacultyReport />;
}
