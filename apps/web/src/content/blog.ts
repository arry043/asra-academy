/**
 * Blog posts for /blog.
 *
 * No blog model, CMS or API exists, and no articles have been supplied (CLIENT-CLARIFICATIONS
 * X-03). The index renders an empty state and stays out of the sitemap and search indexes
 * until at least one post is published. Article pages (/blog/[slug]) will be added together with
 * the content source.
 */
export interface BlogPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date of publication. */
  publishedAt: string;
  author?: string;
}

/** Published posts only — never drafts. */
export const publishedBlogPosts: BlogPostSummary[] = [];
