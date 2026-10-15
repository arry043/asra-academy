import type { Metadata } from 'next';

import { CourseCategoriesManager } from '@/components/admin/catalogue-configs';

export const metadata: Metadata = { title: 'Course categories' };

export default function Page() {
  return <CourseCategoriesManager />;
}
