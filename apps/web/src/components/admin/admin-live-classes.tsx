'use client';

import { PageHeader } from '@/components/layout/page-header';
import { LiveClassesManager } from '@/components/live-classes/live-classes-manager';

/**
 * `/admin/live-classes` (PHASE 11): schedule classes for any course, assign the host faculty,
 * manage meeting links, cancel, complete and add recording links. Requires `live_classes.manage`
 * (enforced by the API).
 */
export function AdminLiveClasses() {
  return (
    <>
      <PageHeader
        title="Live classes"
        breadcrumbs={[{ label: 'Overview', href: '/admin' }, { label: 'Live classes' }]}
        description="Create a class, assign its course and host faculty, schedule it and share the meeting link. Enrolled students are notified by email and in the portal."
      />
      <LiveClassesManager scope="admin" />
    </>
  );
}
