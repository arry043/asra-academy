import type { Metadata } from 'next';
import { JobForm } from '@/components/admin/recruitment/job-form';

export const metadata: Metadata = {
  title: 'Post New Job — Admin | ASRA Academy',
};

export default function AdminNewJobPage() {
  return <JobForm />;
}
