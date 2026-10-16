import type { Metadata } from 'next';

import { StudentProfile } from '@/components/student/student-profile';

export const metadata: Metadata = { title: 'Profile' };

export default function StudentProfilePage() {
  return <StudentProfile />;
}
