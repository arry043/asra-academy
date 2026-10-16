import type { Metadata } from 'next';

import { CourseOverview } from '@/components/student/course-overview';

export const metadata: Metadata = { title: 'Course' };

export default async function StudentCoursePage({
  params,
}: PageProps<'/student/courses/[courseId]'>) {
  const { courseId } = await params;
  return <CourseOverview courseId={courseId} />;
}
