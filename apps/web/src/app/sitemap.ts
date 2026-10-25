import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';
import { getIndexablePaths, getSitemapCourses } from '@/lib/sitemap';

// Regenerated at most hourly (ISR): new or unpublished courses appear/disappear within an hour.
// Must stay a literal (statically analysed); keep equal to SITEMAP_REVALIDATE_SECONDS.
export const revalidate = 3600;

/** /sitemap.xml — public pages and published PUBLIC courses on the canonical origin. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = getIndexablePaths().map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
  const courses: MetadataRoute.Sitemap = (await getSitemapCourses()).map((course) => ({
    url: absoluteUrl(`/courses/${encodeURIComponent(course.slug)}`),
    lastModified: course.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  const seen = new Set<string>();
  return [...pages, ...courses].filter((entry) => !seen.has(entry.url) && seen.add(entry.url));
}
