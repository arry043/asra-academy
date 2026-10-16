import type { Metadata } from 'next';

import { FacultyCoursesPage } from '@/components/faculty/faculty-dashboard';

export const metadata: Metadata = { title: 'My courses' };

export default function FacultyMyCoursesPage() {
  return <FacultyCoursesPage mode="course" />;
}
