/**
 * PHASE 14 — security/performance hardening of the API: default-deny HTTP caching (nothing
 * personal can end up in a shared cache), the explicit public-catalogue cache policy, and the
 * sitemap feed that only exposes published PUBLIC course URLs.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { PublicSitemapCourse } from '@asra/types';
import { createApp } from '../src/app.js';
import {
  PUBLIC_CATALOGUE_CACHE_CONTROL,
  SITEMAP_FEED_CACHE_CONTROL,
} from '../src/config/constants.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { resetAuthState } from './support/auth.js';
import { tokenFor } from './support/catalog.js';
import { uniqueSuffix } from './support/fixtures.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(async () => {
  await resetAuthState();
});

type Publication = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Visibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

async function course(status: Publication, visibility: Visibility) {
  const slug = `p14-${status.toLowerCase()}-${visibility.toLowerCase()}-${uniqueSuffix()}`;
  await prisma.course.create({
    data: {
      title: `Course ${slug}`,
      slug,
      status,
      visibility,
      publishedAt: status === 'DRAFT' ? null : new Date(),
    },
  });
  return slug;
}

describe('default-deny caching', () => {
  it('marks public, error and unknown-route responses no-store', async () => {
    const client = new TestClient(baseUrl);
    for (const [method, path] of [
      ['GET', '/health'],
      ['GET', '/certificates/verify/ASRA-2026-AAAA-BBBB'], // revocations must show immediately
      ['GET', '/courses/does-not-exist'], // 404 is never cached, even on a public route
      ['GET', '/courses?pageSize=500'], // 422
      ['GET', '/no-such-route'],
      ['GET', '/auth/me'], // 401
      ['POST', '/payments/webhooks/razorpay/test'], // 503 (webhooks not configured in tests)
    ] as const) {
      const res = await client.request(method, path);
      assert.equal(
        res.headers.get('cache-control'),
        'no-store',
        `${method} ${path} (${res.status})`,
      );
    }
  });

  it('keeps personalised portal responses no-store', async () => {
    const client = new TestClient(baseUrl);
    for (const [role, path] of [
      ['STUDENT', '/student/dashboard'],
      ['FACULTY', '/faculty/dashboard'],
      ['SUPER_ADMIN', '/admin/dashboard'],
    ] as const) {
      const res = await client.request('GET', path, { token: await tokenFor(client, role) });
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get('cache-control'), 'no-store', path);
    }
  });

  it('lets only successful public catalogue reads be cached briefly by shared caches', async () => {
    const slug = await course('PUBLISHED', 'PUBLIC');
    const client = new TestClient(baseUrl);
    for (const path of ['/courses', `/courses/${slug}`]) {
      const res = await client.request('GET', path);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get('cache-control'), PUBLIC_CATALOGUE_CACHE_CONTROL, path);
    }
    // Browsers always revalidate; a CDN may hold a copy for at most a minute.
    assert.match(PUBLIC_CATALOGUE_CACHE_CONTROL, /\bmax-age=0\b/);
    assert.match(PUBLIC_CATALOGUE_CACHE_CONTROL, /\bs-maxage=60\b/);
    // The public catalogue never varies by credentials, so a shared copy cannot leak anything.
    const signedIn = await client.request('GET', '/courses', {
      token: await tokenFor(client, 'STUDENT'),
    });
    const anonymous = await client.request('GET', '/courses');
    assert.deepEqual(signedIn.body.data, anonymous.body.data);
  });
});

describe('sitemap feed (GET /sitemap/courses)', () => {
  it('lists only published PUBLIC courses, with slug and last-modified time only', async () => {
    const listed = await course('PUBLISHED', 'PUBLIC');
    const hidden = await Promise.all([
      course('PUBLISHED', 'UNLISTED'),
      course('PUBLISHED', 'PRIVATE'),
      course('DRAFT', 'PUBLIC'),
      course('ARCHIVED', 'PUBLIC'),
    ]);

    const res = await new TestClient(baseUrl).request<PublicSitemapCourse[]>(
      'GET',
      '/sitemap/courses',
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), SITEMAP_FEED_CACHE_CONTROL);
    const slugs = res.body.data.map((entry) => entry.slug);
    assert.deepEqual(slugs, [listed]);
    for (const slug of hidden) assert.ok(!slugs.includes(slug), slug);
    assert.deepEqual(Object.keys(res.body.data[0]!).sort(), ['slug', 'updatedAt']);
    assert.ok(!Number.isNaN(Date.parse(res.body.data[0]!.updatedAt)));
  });

  it('does not shadow a course whose slug is "sitemap"', async () => {
    await prisma.course.create({
      data: {
        title: 'Sitemap',
        slug: 'sitemap',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    });
    const res = await new TestClient(baseUrl).request<{ slug: string }>('GET', '/courses/sitemap');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.slug, 'sitemap');
  });
});
