import type { Metadata } from 'next';

import { CourseDetail } from '@/components/admin/course-detail';

export const metadata: Metadata = { title: 'Course' };

export default async function AdminCoursePage({ params }: PageProps<'/admin/courses/[id]'>) {
  const { id } = await params;
  return <CourseDetail id={id} />;
}
