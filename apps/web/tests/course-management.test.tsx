/**
 * PHASE 06 web: admin helpers (money, duration, ordering, redirects, permissions), the course
 * form's payload mapping, reserved course slugs vs programme pages, and the public catalogue
 * (listing states, course page markup, slug routing) with the API stubbed at `fetch`.
 *
 * Interactive admin flows (dialogs, tabs, publish confirmation) need a browser; they were
 * exercised against the real API — see docs/COURSE-MANAGEMENT.md §9.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AuthUser, Paginated, PublicCourseDetail, PublicCourseSummary } from '@asra/types';
import { RESERVED_COURSE_SLUGS } from '@asra/validation';

import CourseSlugPage from '@/app/(public)/courses/[slug]/page';
import { canUseAdminPortal } from '@/components/admin/use-admin';
import { toCoursePayload } from '@/components/admin/course-form';
import { PublicCoursePage } from '@/components/public/public-course-page';
import { PublishedCourses } from '@/components/public/published-courses';
import { getProgrammesByKind } from '@/lib/programmes';
import {
  formatDiscount,
  formatMoney,
  joinMinutes,
  minorToInput,
  moveItem,
  parseMoneyInput,
  safeNextPath,
  splitMinutes,
} from '@/lib/admin/format';
import { getPublicCourse, toCourseCard, toParagraphs } from '@/lib/catalog';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replaces `fetch` with a stub answering in the API envelope. */
function stubApi(status: number, data: unknown, calls: string[] = []) {
  globalThis.fetch = (async (input: string | URL) => {
    calls.push(String(input));
    const body =
      status < 400
        ? { success: true, message: 'OK', data }
        : {
            success: false,
            message: 'Course not found',
            error: { code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR' },
          };
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

const summary: PublicCourseSummary = {
  slug: 'class-10-mathematics',
  title: 'Class 10 Mathematics',
  summary: 'CBSE Class 10 Mathematics.',
  thumbnailUrl: null,
  category: { name: 'School Education', slug: 'school-education' },
  class: { name: 'Class 10', slug: 'class-10' },
  stream: null,
  subject: { name: 'Mathematics', slug: 'mathematics' },
  durationMinutes: 3600,
  instructors: [],
  publishedAt: '2026-10-15T08:00:00.000Z',
};

const detail: PublicCourseDetail = {
  ...summary,
  description: 'Real numbers and polynomials.\n\nQuadratic equations.',
  visibility: 'PUBLIC',
  lessonCount: 1,
  curriculum: [
    {
      title: 'Algebra',
      description: null,
      chapters: [
        {
          title: 'Quadratic Equations',
          lessons: [{ title: 'Factorisation', contentType: 'VIDEO', durationSeconds: 900 }],
        },
      ],
    },
  ],
};

const page = <T,>(items: T[], total = items.length): Paginated<T> => ({
  items,
  pagination: { page: 1, pageSize: 12, total, pageCount: Math.max(1, Math.ceil(total / 12)) },
});

describe('admin money and duration helpers', () => {
  it('parses amounts into minor units without rounding silently', () => {
    assert.equal(parseMoneyInput(''), null);
    assert.equal(parseMoneyInput('2500'), 250000);
    assert.equal(parseMoneyInput('2,500.5'), 250050);
    assert.equal(parseMoneyInput('0.05'), 5);
    assert.equal(parseMoneyInput('-10'), undefined);
    assert.equal(parseMoneyInput('10.999'), undefined);
    assert.equal(parseMoneyInput('ten'), undefined);
    assert.equal(minorToInput(250050), '2500.50');
    assert.equal(minorToInput(null), '');
  });

  it('formats prices and discounts without computing a final price', () => {
    assert.equal(formatMoney(null, null), null);
    assert.equal(formatMoney(0, 'INR'), 'Free');
    assert.equal(formatMoney(250000, 'INR'), '₹2,500.00');
    assert.equal(formatDiscount('PERCENTAGE', 10, 'INR'), '10% off');
    assert.equal(formatDiscount('FIXED_AMOUNT', 50000, 'INR'), '₹500.00 off');
    assert.equal(formatDiscount(null, null, 'INR'), null);
  });

  it('splits and joins the duration inputs', () => {
    assert.deepEqual(splitMinutes(135), { hours: '2', minutes: '15' });
    assert.equal(joinMinutes('2', '15'), 135);
    assert.equal(joinMinutes('', ''), null);
    assert.equal(joinMinutes('1.5', ''), undefined);
    assert.equal(joinMinutes('-1', '0'), undefined);
  });

  it('moves items up and down, refusing to move past the edges', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']);
    assert.equal(moveItem(['a', 'b'], 0, -1), null);
    assert.equal(moveItem(['a', 'b'], 1, 1), null);
  });
});

describe('course form payload', () => {
  const base = {
    title: 'Maths',
    slug: '',
    summary: '',
    description: '',
    visibility: 'PUBLIC' as const,
    categoryId: 'none',
    classId: 'none',
    streamId: 'none',
    subjectId: 'none',
    thumbnailUrl: '',
    durationHours: '',
    durationMinutes: '',
    price: '',
    currency: 'INR',
    discountType: 'none' as const,
    discountValue: '',
  };

  it('maps "none" relations and empty price to null (no currency without a price)', () => {
    const { body, errors } = toCoursePayload(base);
    assert.deepEqual(errors, {});
    assert.equal(body.categoryId, null);
    assert.equal(body.priceMinor, null);
    assert.equal(body.currency, null);
    assert.equal(body.discountType, null);
  });

  it('converts price, fixed discount and duration to minor units / minutes', () => {
    const { body } = toCoursePayload({
      ...base,
      price: '2500',
      discountType: 'FIXED_AMOUNT',
      discountValue: '500.50',
      durationHours: '40',
      durationMinutes: '30',
    });
    assert.equal(body.priceMinor, 250000);
    assert.equal(body.currency, 'INR');
    assert.equal(body.discountValue, 50050);
    assert.equal(body.durationMinutes, 2430);
  });

  it('reports unparseable inputs on the right field', () => {
    const { errors } = toCoursePayload({ ...base, price: '12,5.5.5', durationHours: 'x' });
    assert.ok(errors.priceMinor);
    assert.ok(errors.durationMinutes);
  });
});

describe('admin access helpers', () => {
  const user = (permissions: string[]): AuthUser => ({
    id: 'u',
    email: 'a@example.test',
    fullName: 'A',
    emailVerified: true,
    roles: [],
    permissions,
  });

  it('offers the portal only to users with an admin permission', () => {
    assert.equal(canUseAdminPortal(null), false);
    assert.equal(canUseAdminPortal(user(['profile.manage_own', 'content.view_enrolled'])), false);
    assert.equal(canUseAdminPortal(user(['content.manage_assigned'])), false);
    assert.equal(canUseAdminPortal(user(['courses.manage'])), true);
  });

  it('only follows same-site redirect paths after sign-in', () => {
    assert.equal(safeNextPath('/admin/courses'), '/admin/courses');
    for (const unsafe of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'admin',
      '',
      null,
    ]) {
      assert.equal(safeNextPath(unsafe, '/'), '/', String(unsafe));
    }
  });
});

describe('reserved course slugs', () => {
  it('reserves exactly the special-course programme slugs served at /courses/<slug>', () => {
    const programmeSlugs = getProgrammesByKind('special-course')
      .map((programme) => programme.slug)
      .sort();
    assert.deepEqual([...RESERVED_COURSE_SLUGS].sort(), programmeSlugs);
  });
});

describe('public catalogue mapping', () => {
  it('maps a published course onto the course card without invented data', () => {
    const card = toCourseCard(summary);
    assert.equal(card.title, 'Class 10 Mathematics');
    assert.equal(card.subject, 'Class 10 · Mathematics');
    assert.equal(card.durationLabel, '60 hr');
    assert.deepEqual(card.action, { href: '/courses/class-10-mathematics', label: 'View course' });
    assert.equal(card.instructorName, undefined);
    assert.equal(card.status, undefined, 'public cards never show draft badges');
  });

  it('splits descriptions into text paragraphs', () => {
    assert.deepEqual(toParagraphs('One.\n\n  Two.\n\n\n'), ['One.', 'Two.']);
    assert.deepEqual(toParagraphs(null), []);
  });
});

describe('published courses section', () => {
  it('shows an honest empty state when nothing is published', async () => {
    stubApi(200, page([]));
    const markup = html(await PublishedCourses({}));
    assert.match(markup, /No courses are published yet/);
    assert.doesNotMatch(markup, /Class 10 Mathematics/);
  });

  it('lists published courses with links to their pages', async () => {
    const calls = stubApi(200, page([summary]));
    const markup = html(await PublishedCourses({ page: 1 }));
    assert.match(markup, /Class 10 Mathematics/);
    assert.match(markup, /href="\/courses\/class-10-mathematics"/);
    assert.match(calls[0]!, /\/courses\?page=1&pageSize=12$/);
  });

  it('degrades to a notice when the API is unreachable', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const markup = html(await PublishedCourses({}));
    assert.match(markup, /Course listings are unavailable right now/);
  });
});

describe('public course page', () => {
  it('renders the outline of published lessons and no prices or resource links', () => {
    const markup = html(<PublicCoursePage course={detail} />);
    assert.match(markup, /<h1[^>]*>Class 10 Mathematics<\/h1>/);
    assert.match(markup, /Module 1: Algebra/);
    assert.match(markup, /Factorisation/);
    assert.match(markup, /Real numbers and polynomials\./);
    assert.match(markup, /To be announced/);
    assert.doesNotMatch(markup, /₹|INR/);
    assert.doesNotMatch(markup, /Faculty<\/h2>/, 'no faculty section without public faculty');
  });

  it('lists only the faculty the API returns as public', () => {
    const markup = html(
      <PublicCoursePage
        course={{
          ...detail,
          instructors: [{ fullName: 'Dr. A. Khan', designation: 'Mathematics Faculty' }],
        }}
      />,
    );
    assert.match(markup, /Dr\. A\. Khan/);
  });

  it('never calls the API for invalid slugs and distinguishes 404 from outages', async () => {
    const calls = stubApi(200, detail);
    assert.deepEqual(await getPublicCourse('Not A Slug'), {
      ok: false,
      reason: 'not-found',
      message: 'Course not found',
    });
    assert.equal(calls.length, 0);

    stubApi(404, null);
    assert.equal((await getPublicCourse('missing-course')).ok, false);
    assert.equal(
      ((await getPublicCourse('missing-course-2')) as { reason: string }).reason,
      'not-found',
    );
    stubApi(500, null);
    assert.equal(
      ((await getPublicCourse('broken-course')) as { reason: string }).reason,
      'unavailable',
    );
  });
});

describe('/courses/[slug] routing', () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it('keeps serving programme pages without calling the API', async () => {
    const calls = stubApi(500, null);
    const markup = html(await CourseSlugPage(params('english')));
    assert.match(markup, /English/);
    assert.equal(calls.length, 0);
  });

  it('renders a published course from the API', async () => {
    stubApi(200, detail);
    const markup = html(await CourseSlugPage(params('class-10-mathematics')));
    assert.match(markup, /Course outline/);
  });

  it('answers 404 for draft, private or unknown courses', async () => {
    stubApi(404, null);
    await assert.rejects(
      CourseSlugPage(params('draft-course')),
      (error: Error & { digest?: string }) => String(error.digest ?? error.message).includes('404'),
    );
  });
});
