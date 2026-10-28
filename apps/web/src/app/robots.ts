import type { MetadataRoute } from 'next';

import { isSiteIndexingEnabled } from '@/lib/feature-flags';
import { absoluteUrl } from '@/lib/seo';

/**
 * Portal shells: client-rendered, signed-in only, `noindex` in their layouts. Disallowed so
 * crawlers do not spend budget on login redirects (e.g. "Enrol now" → /student/checkout/…).
 * Account pages (/login, /register…) stay crawlable on purpose: they are linked from public pages
 * and their `noindex` must be readable, or they could be indexed as bare URLs.
 * The faculty portal is `/faculty/…` with a trailing slash: `/faculty` itself is the public
 * "Our faculty" page and is listed in the sitemap (robots rules are prefix matches).
 */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/student', '/faculty/', '/design-system'] as const;

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
    rules: { userAgent: '*', allow: '/', disallow: [...PRIVATE_PATH_PREFIXES] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
