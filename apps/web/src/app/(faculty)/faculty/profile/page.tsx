import type { Metadata } from 'next';

import { FacultyProfile } from '@/components/faculty/faculty-course';

export const metadata: Metadata = { title: 'Profile' };

export default function FacultyProfilePage() {
  return <FacultyProfile />;
}
