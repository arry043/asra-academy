import type { Metadata } from 'next';

import { PopularCoursesReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Popular courses' };

export default function Page() {
  return <PopularCoursesReport />;
}
