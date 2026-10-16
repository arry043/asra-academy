import type { Metadata } from 'next';

import { LiveClassesPage } from '@/components/faculty/faculty-classes';

export const metadata: Metadata = { title: 'Live classes' };

export default function FacultyClassesPage() {
  return <LiveClassesPage />;
}
