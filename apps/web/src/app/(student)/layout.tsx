import type { Metadata } from 'next';

import { AuthProvider } from '@/components/auth/auth-provider';
import { StudentShell } from '@/components/student/student-shell';

export const metadata: Metadata = {
  title: { template: '%s · Student portal | ASRA Academy', default: 'Student portal' },
  // Private, per-student pages never belong in search results.
  robots: { index: false, follow: false },
};

/**
 * Student portal (PHASE 07). Like `(admin)`, the session provider lives only here and in `(auth)`,
 * so public pages never call the refresh endpoint. The API enforces the STUDENT role and the
 * per-course enrolment on every request.
 */
export default function StudentRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StudentShell>{children}</StudentShell>
    </AuthProvider>
  );
}
