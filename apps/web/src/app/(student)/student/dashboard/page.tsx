import type { Metadata } from 'next';

import { StudentDashboard } from '@/components/student/student-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function StudentDashboardPage() {
  return <StudentDashboard />;
}
