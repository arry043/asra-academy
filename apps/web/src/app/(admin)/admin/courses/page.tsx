import type { Metadata } from 'next';

import { CourseList } from '@/components/admin/course-list';

export const metadata: Metadata = { title: 'Courses' };

export default function AdminCoursesPage() {
  return <CourseList />;
}
