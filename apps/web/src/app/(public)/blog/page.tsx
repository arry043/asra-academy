import { Newspaper } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { EmptyState } from '@/components/public/empty-state';
import { PageHero } from '@/components/public/page-hero';
import { Button } from '@/components/ui/button';
import { publishedBlogPosts } from '@/content/blog';
import { formatDate } from '@/lib/format';
import { buildPageMetadata } from '@/lib/seo';

const posts = publishedBlogPosts;

export const metadata = buildPageMetadata({
  title: 'Blog',
  description: 'Articles and updates from ASRA Academy on learning, languages and education.',
  path: '/blog',
  // An empty index is thin content: keep it out of search results until articles exist.
  noIndex: posts.length === 0,
});

export default function BlogPage() {
  return (
    <>
      <PageHero
        path="/blog"
        breadcrumbs={[{ label: 'Blog' }]}
        eyebrow="Blog"
        title="ASRA Academy blog"
        description={<p>Articles and updates from ASRA Academy.</p>}
      />

      <Container className="py-section">
        {posts.length > 0 ? (
          <section aria-labelledby="posts-title" className="grid gap-6">
            <h2 id="posts-title" className="sr-only">
              Latest articles
            </h2>
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.slug}>
                  <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
                    <h3 className="type-h4 text-heading">{post.title}</h3>
                    <p className="type-body-sm text-muted-foreground">{post.excerpt}</p>
                    <p className="mt-auto type-caption text-muted-foreground">
                      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                      {post.author ? ` · ${post.author}` : null}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState
            icon={<Newspaper />}
            title="No articles yet"
            description="ASRA Academy has not published any articles yet. Please check back later — in the meantime, explore our courses."
            action={
              <Button asChild>
                <Link href="/courses">Explore courses</Link>
              </Button>
            }
          />
        )}
      </Container>
    </>
  );
}
