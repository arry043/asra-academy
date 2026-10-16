import type { Metadata } from 'next';

import { FacultyCoursesPage } from '@/components/faculty/faculty-dashboard';

export const metadata: Metadata = { title: 'Content' };

export default function FacultyContentPage() {
  return <FacultyCoursesPage mode="content" />;
}
