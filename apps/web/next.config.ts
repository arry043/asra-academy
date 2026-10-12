import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Load the monorepo root `.env` so web and API share one local configuration file.
// `apps/web/.env*` files, if present, are still loaded by Next.js and take precedence.
loadEnvConfig(path.resolve(process.cwd(), '../..'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
