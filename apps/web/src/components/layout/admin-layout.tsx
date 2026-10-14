import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Sidebar } from '@/components/layout/sidebar';
import type { NavGroup } from '@/lib/navigation';

type AdminLayoutProps = {
  navigation: NavGroup[];
  headerActions?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  contextLabel?: string;
  brandHref?: string;
  children: React.ReactNode;
};

/**
 * Administration shell: the shared `DashboardLayout` with the deep-green admin rail and an
 * "Administration" context badge, so staff always know they are in a privileged area.
 *
 * Visual only. Admin routes must still be protected server-side (requireRole / requirePermission
 * in the API and route-level checks in the web app) — never by hiding navigation.
 */
export function AdminLayout({
  navigation,
  headerActions,
  sidebarFooter,
  contextLabel = 'Administration',
  brandHref,
  children,
}: AdminLayoutProps) {
  return (
    <DashboardLayout
      tone="admin"
      contextLabel={contextLabel}
      headerActions={headerActions}
      sidebarFooter={sidebarFooter}
      brandHref={brandHref}
      sidebar={<Sidebar groups={navigation} label={contextLabel} tone="admin" />}
    >
      {children}
    </DashboardLayout>
  );
}
