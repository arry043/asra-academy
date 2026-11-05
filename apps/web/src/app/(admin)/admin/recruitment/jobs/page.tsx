import type { Metadata } from 'next';
import { JobList } from '@/components/admin/recruitment/job-list';

export const metadata: Metadata = {
  title: 'Manage Job Openings — Admin | ASRA Academy',
};

export default function AdminJobsPage() {
  return <JobList />;
}
