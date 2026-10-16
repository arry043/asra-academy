import type { Metadata } from 'next';

import { AuthProvider } from '@/components/auth/auth-provider';
import { FacultyShell } from '@/components/faculty/faculty-shell';

export const metadata: Metadata = {
  title: { template: '%s · Faculty portal | ASRA Academy', default: 'Faculty portal' },
  // Private teaching pages never belong in search results.
  robots: { index: false, follow: false },
};

/**
 * Faculty portal (PHASE 08). Like `(admin)` and `(student)`, the session provider lives only in
 * the protected route groups. The API enforces the FACULTY role, each permission and the
 * per-course assignment on every request.
 */
export default function FacultyRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FacultyShell>{children}</FacultyShell>
    </AuthProvider>
  );
}
