import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationList } from '@/components/admin/recruitment/application-list';
import { LoadingPanel } from '@/components/admin/admin-ui';

export const metadata: Metadata = {
  title: 'Candidate Applications — Admin | ASRA Academy',
};

export default function AdminApplicationsPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading applications…" />}>
      <ApplicationList />
    </Suspense>
  );
}
