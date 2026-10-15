import { publishedBlogPosts } from '@/content/blog';
import { legalDocuments } from '@/content/legal';
import { programmes } from '@/content/programmes';

/**
 * Public, indexable site paths. Excluded on purpose: account pages (/login, /register, password
 * and verification flows — `noindex`), the internal /design-system showcase, future portals,
 * and /blog while it has no published posts. Blog article URLs are added only when real posts
 * exist (none yet, so none are listed).
 */
export function getIndexablePaths(): string[] {
  return [
    '/',
    '/about',
    '/courses',
    ...programmes.map((programme) => programme.href),
    '/faculty',
    '/admission',
    '/contact',
    ...(publishedBlogPosts.length > 0 ? ['/blog'] : []),
    ...Object.values(legalDocuments).map((document) => document.path),
  ];
}
