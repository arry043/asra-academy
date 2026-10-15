import type { Metadata } from 'next';

import { SubjectsManager } from '@/components/admin/catalogue-configs';

export const metadata: Metadata = { title: 'Subjects' };

export default function Page() {
  return <SubjectsManager />;
}
