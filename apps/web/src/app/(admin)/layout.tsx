import type { Metadata } from 'next';

import { AdminShell } from '@/components/admin/admin-shell';
import { AuthProvider } from '@/components/auth/auth-provider';

export const metadata: Metadata = {
  title: { template: '%s · Administration | ASRA Academy', default: 'Administration' },
  // Administration pages never belong in search results.
  robots: { index: false, follow: false },
};

/**
 * Admin portal (PHASE 06). The session provider lives here and in `(auth)` only, so public pages
 * never call the refresh endpoint. Access control is enforced by the API on every request.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
