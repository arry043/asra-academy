'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import type { AdminJobDetailDto } from '@asra/types';
import { JobForm } from '@/components/admin/recruitment/job-form';
import { LoadingPanel, ErrorPanel } from '@/components/admin/admin-ui';
import { useAdminApi, useApiResource } from '@/components/admin/use-admin';

export default function AdminEditJobPage() {
  const params = useParams();
  const id = params.id as string;
  const api = useAdminApi();

  const {
    data: job,
    loading,
    error,
    reload,
  } = useApiResource<AdminJobDetailDto>(id ? `/admin/recruitment/jobs/${id}` : null, () =>
    api.get<AdminJobDetailDto>(`/admin/recruitment/jobs/${id}`),
  );

  if (loading) return <LoadingPanel label="Loading job details…" />;
  if (error || !job) {
    return (
      <ErrorPanel
        title="Could not load job details"
        message={error?.message || 'Failed to load job details.'}
        onRetry={reload}
      />
    );
  }

  return <JobForm initialJob={job} />;
}
