import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';
import { getIndexablePaths } from '@/lib/sitemap';

/** /sitemap.xml — public pages on the canonical origin (NEXT_PUBLIC_APP_URL). */
export default function sitemap(): MetadataRoute.Sitemap {
  return getIndexablePaths().map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
