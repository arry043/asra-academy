import type { Metadata } from 'next';

import { AcademicLevelsManager } from '@/components/admin/catalogue-configs';

export const metadata: Metadata = { title: 'Academic levels' };

export default function Page() {
  return <AcademicLevelsManager />;
}
