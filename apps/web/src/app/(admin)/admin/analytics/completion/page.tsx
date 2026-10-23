import type { Metadata } from 'next';

import { CompletionReport } from '@/components/admin/analytics';

export const metadata: Metadata = { title: 'Analytics · Completion' };

export default function Page() {
  return <CompletionReport />;
}
