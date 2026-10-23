import type { Metadata } from 'next';

import { ExamsReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Exam performance' };

export default function Page() {
  return <ExamsReport />;
}
