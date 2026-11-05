'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ApplicationDetail } from '@/components/admin/recruitment/application-detail';

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <ApplicationDetail id={id} />;
}
