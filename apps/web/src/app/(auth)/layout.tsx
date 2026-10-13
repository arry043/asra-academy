import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth/auth-provider';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  // Account pages never belong in search results.
  robots: { index: false, follow: false },
};

/**
 * Layout for the authentication pages only. The session provider lives here (not in the root
 * layout) so public pages never call the refresh endpoint.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-asra-green-100/70 to-transparent"
        />
        {children}
        <p className="text-center text-xs text-muted-foreground">
          {siteConfig.name} · {siteConfig.tagline}
        </p>
      </main>
    </AuthProvider>
  );
}
