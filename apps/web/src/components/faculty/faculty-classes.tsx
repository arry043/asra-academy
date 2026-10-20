'use client';

import { PageHeader } from '@/components/layout/page-header';
import { LiveClassesManager } from '@/components/live-classes/live-classes-manager';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };

/**
 * Scheduling for the faculty member's assigned courses (PHASE 08; PHASE 11 adds Google Meet
 * links, completion and recording links). The shared manager talks to `/faculty/live-classes`,
 * which only ever returns the caller's courses.
 */
export function LiveClassesPanel({ courseId }: { courseId?: string }) {
  return <LiveClassesManager scope="faculty" courseId={courseId} />;
}

export function LiveClassesPage() {
  return (
    <>
      <PageHeader
        title="Live classes"
        breadcrumbs={[home, { label: 'Live classes' }]}
        description="Schedule online classes for your courses, share the meeting link and add the recording afterwards. Enrolled students are notified."
      />
      <LiveClassesPanel />
    </>
  );
}
