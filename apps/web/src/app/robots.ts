import type { MetadataRoute } from 'next';

import { isSiteIndexingEnabled } from '@/lib/feature-flags';
import { absoluteUrl } from '@/lib/seo';

/**
 * /robots.txt. Crawling guidance only — NOT access control (protected routes are enforced by the
 * API's authentication and RBAC). Unless SITE_INDEXING_ENABLED=true at build time, the whole site
 * is disallowed so preview and staging deployments never get indexed.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexingEnabled()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/design-system'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
