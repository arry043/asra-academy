import type { Metadata } from 'next';

import { StreamsManager } from '@/components/admin/catalogue-configs';

export const metadata: Metadata = { title: 'Streams' };

export default function Page() {
  return <StreamsManager />;
}
