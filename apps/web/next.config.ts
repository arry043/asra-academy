import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import { assertIndexableSiteUrl, buildSecurityHeaders } from './src/config/deployment';

// Load the monorepo root `.env` so web and API share one local configuration file.
// `apps/web/.env*` files, if present, are still loaded by Next.js and take precedence.
loadEnvConfig(path.resolve(process.cwd(), '../..'));

// Same defaults as src/lib/env.ts.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

if (process.env.SITE_INDEXING_ENABLED === 'true') assertIndexableSiteUrl(appUrl);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Security headers (PHASE 14, docs/SECURITY.md §4). CSP and friends govern documents, so the
  // hashed build assets under /_next only get `nosniff` — the ~0.7 KB CSP is not repeated on
  // every script, style and image response.
  async headers() {
    return [
      {
        source: '/_next/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
      {
        source: '/:path((?!_next/).*)',
        headers: buildSecurityHeaders({
          appUrl,
          apiUrl,
          isDev: process.env.NODE_ENV === 'development',
        }),
      },
    ];
  },
};

export default nextConfig;
