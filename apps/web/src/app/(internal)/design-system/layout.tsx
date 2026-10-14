import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { isDesignSystemEnabled } from '@/lib/feature-flags';

export const metadata: Metadata = {
  title: { default: 'Design system', template: '%s · Design system' },
  description: 'Internal ASRA Academy design-system showcase (demo data only).',
  robots: { index: false, follow: false },
};

/**
 * Gate for the internal showcase and its layout previews. Evaluated per request on the server
 * (not a client-side check), so a production deployment without ENABLE_DESIGN_SYSTEM=true
 * returns 404 for every /design-system route.
 */
export default async function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  await connection();
  if (!isDesignSystemEnabled()) notFound();
  return children;
}
