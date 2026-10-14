import { Bell } from 'lucide-react';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { demoAdminNav } from '../_fixtures';

export const metadata = { title: 'Admin preview' };

/** AdminLayout preview with demo navigation. Layout foundation only — no admin features. */
export default function AdminPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout
      navigation={demoAdminNav}
      contextLabel="Administration (demo)"
      brandHref="/design-system"
      headerActions={
        <>
          <Button variant="ghost" size="icon" aria-label="Notifications (demo)">
            <Bell className="size-5" aria-hidden />
          </Button>
          <Avatar name="Demo Admin" size="sm" />
        </>
      }
    >
      {children}
    </AdminLayout>
  );
}
