import type { Metadata } from 'next';

import { FacultyDashboard } from '@/components/faculty/faculty-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function FacultyDashboardPage() {
  return <FacultyDashboard />;
}
