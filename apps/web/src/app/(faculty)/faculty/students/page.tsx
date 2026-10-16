import type { Metadata } from 'next';

import { StudentsPage } from '@/components/faculty/faculty-students';

export const metadata: Metadata = { title: 'Students' };

export default function FacultyStudentsPage() {
  return <StudentsPage />;
}
