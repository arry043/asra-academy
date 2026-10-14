import { Bell, LifeBuoy } from 'lucide-react';
import Link from 'next/link';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Sidebar } from '@/components/layout/sidebar';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { demoStudentNav } from '../_fixtures';

export const metadata = { title: 'Dashboard preview' };

/** DashboardLayout preview with demo navigation. Layout foundation only — no student features. */
export default function DashboardPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      contextLabel="Student portal (demo)"
      brandHref="/design-system"
      sidebar={<Sidebar groups={demoStudentNav} label="Student portal (demo)" />}
      sidebarFooter={
        <Link
          href="/design-system#layouts"
          className="flex items-center gap-2 rounded-md type-body-sm text-muted-foreground hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <LifeBuoy className="size-4" aria-hidden /> Back to showcase
        </Link>
      }
      headerActions={
        <>
          <Button variant="ghost" size="icon" aria-label="Notifications (demo)">
            <Bell className="size-5" aria-hidden />
          </Button>
          <Avatar name="Demo Student" size="sm" status="online" />
        </>
      }
    >
      {children}
    </DashboardLayout>
  );
}
