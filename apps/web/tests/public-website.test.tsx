/**
 * PHASE 05 public website: course search/filter logic, WhatsApp and enquiry links, the shared
 * enquiry schema, SEO helpers, sitemap/robots output, navigation integrity and the honest
 * empty/pending states. Interactive behaviour (menus, filters in the browser, the contact form)
 * is verified in a real browser — see docs/PUBLIC-WEBSITE.md §9.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { enquirySchema } from '@asra/validation';

import robots, { PRIVATE_PATH_PREFIXES } from '@/app/robots';
import sitemap from '@/app/sitemap';
import { EmptyState } from '@/components/public/empty-state';
import { LegalPage } from '@/components/public/legal-page';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { ProgrammePage } from '@/components/public/programme-page';
import { WhatsAppLink } from '@/components/public/whatsapp-link';
import { footerNavigation, legalNavigation, publicNavigation } from '@/config/navigation';
import { legalDocuments } from '@/content/legal';
import { programmes } from '@/content/programmes';
import { buildEnquiryMailto, ENQUIRY_TOPIC_LABELS, isEnquiryTopic } from '@/lib/enquiry';
import { isActiveNavItem } from '@/lib/navigation';
import {
  countByCategory,
  filterProgrammes,
  getProgramme,
  getRelatedProgrammes,
  MAX_QUERY_LENGTH,
  normalizeSearchText,
  parseProgrammeFilters,
  toProgrammeSearchParams,
} from '@/lib/programmes';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  organizationJsonLd,
  serializeJsonLd,
} from '@/lib/seo';
import { getIndexablePaths } from '@/lib/sitemap';
import { buildWhatsAppUrl, whatsAppEnquiryMessage } from '@/lib/whatsapp';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const slugs = (items: { slug: string }[]) => items.map((item) => item.slug);
const params = (query: string) => new URLSearchParams(query);

/** The public routes required by PHASE 05 (and the existing /login). */
const REQUIRED_ROUTES = [
  '/',
  '/about',
  '/courses',
  '/classes/6-10',
  '/classes/11-12',
  '/courses/english',
  '/courses/entrepreneurship',
  '/courses/quranic-studies',
  '/courses/arabic',
  '/courses/urdu',
  '/faculty',
  '/admission',
  '/contact',
  '/blog',
  '/privacy-policy',
  '/terms',
  '/refund-policy',
];

/** Resolves a site path to its page file in the App Router tree (route groups + dynamic segments). */
function routeExists(href: string): boolean {
  const app = path.resolve(import.meta.dirname, '../src/app');
  const clean = href.split(/[?#]/)[0]!;
  const segments = clean.split('/').filter(Boolean);
  const groups = ['(public)', '(auth)'];
  return groups.some((group) => {
    const direct = path.join(app, group, ...segments, 'page.tsx');
    if (existsSync(direct)) return true;
    if (segments.length === 2) {
      const dynamic = { courses: '[slug]', classes: '[band]' }[segments[0]!];
      if (dynamic && existsSync(path.join(app, group, segments[0]!, dynamic, 'page.tsx'))) {
        return programmes.some((programme) => programme.href === clean);
      }
    }
    return false;
  });
}

describe('programme catalogue', () => {
  it('covers the two class bands and five special courses from the client order', () => {
    assert.deepEqual(slugs(programmes), [
      'classes-6-10',
      'classes-11-12',
      'english',
      'entrepreneurship',
      'quranic-studies',
      'arabic',
      'urdu',
    ]);
  });
  it('never carries invented commercial data', () => {
    const text = JSON.stringify(programmes);
    assert.doesNotMatch(text, /₹|\bINR\b|\bfee\b.*\d|\bweeks?\b|\bmonths?\b|rating|certificate/i);
  });
});

describe('filterProgrammes', () => {
  it('returns everything with no filters', () => {
    assert.equal(filterProgrammes(programmes, { query: '', category: 'all' }).length, 7);
  });
  it('searches case-insensitively across titles, topics and subjects', () => {
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: 'TAJWEED', category: 'all' })), [
      'quranic-studies',
    ]);
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: 'grammar', category: 'all' })), [
      'english',
      'arabic',
      'urdu',
    ]);
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: 'physics', category: 'all' })), [
      'classes-11-12',
    ]);
  });
  it('ignores accents, punctuation and word order', () => {
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: 'Tajwéed', category: 'all' })), [
      'quranic-studies',
    ]);
    assert.equal(
      normalizeSearchText('Entrepreneurship & Business!'),
      'entrepreneurship and business',
    );
    assert.deepEqual(
      slugs(filterProgrammes(programmes, { query: 'planning business', category: 'all' })),
      ['entrepreneurship'],
    );
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: 'CBSE', category: 'all' })), [
      'classes-6-10',
    ]);
  });
  it('filters by category', () => {
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: '', category: 'language' })), [
      'english',
      'arabic',
      'urdu',
    ]);
    assert.deepEqual(slugs(filterProgrammes(programmes, { query: '', category: 'school' })), [
      'classes-6-10',
      'classes-11-12',
    ]);
  });
  it('combines search and category', () => {
    assert.deepEqual(
      slugs(filterProgrammes(programmes, { query: 'writing', category: 'language' })),
      ['english', 'arabic', 'urdu'],
    );
    assert.deepEqual(filterProgrammes(programmes, { query: 'grammar', category: 'school' }), []);
    assert.deepEqual(filterProgrammes(programmes, { query: 'xyzzy', category: 'all' }), []);
  });
  it('counts programmes per category', () => {
    assert.deepEqual(countByCategory(programmes), {
      all: 7,
      school: 2,
      language: 3,
      business: 1,
      quranic: 1,
    });
  });
});

describe('course filter URL state', () => {
  it('parses valid params and rejects unknown categories', () => {
    assert.deepEqual(parseProgrammeFilters(params('q=%20urdu%20&category=language')), {
      query: 'urdu',
      category: 'language',
    });
    assert.deepEqual(parseProgrammeFilters(params('category=admin')), {
      query: '',
      category: 'all',
    });
    assert.deepEqual(parseProgrammeFilters(params('category=toString')), {
      query: '',
      category: 'all',
    });
  });
  it('caps the query length', () => {
    const long = 'a'.repeat(500);
    assert.equal(parseProgrammeFilters(params(`q=${long}`)).query.length, MAX_QUERY_LENGTH);
  });
  it('serialises only active filters and round-trips', () => {
    assert.equal(toProgrammeSearchParams({ query: '  ', category: 'all' }), '');
    const query = toProgrammeSearchParams({ query: 'spoken english', category: 'language' });
    assert.equal(query, 'q=spoken+english&category=language');
    assert.deepEqual(parseProgrammeFilters(params(query)), {
      query: 'spoken english',
      category: 'language',
    });
  });
});

describe('related programmes', () => {
  it('excludes the current programme and prefers the same category', () => {
    assert.deepEqual(slugs(getRelatedProgrammes('arabic', 3)), ['english', 'urdu', 'classes-6-10']);
    assert.ok(!slugs(getRelatedProgrammes('classes-6-10', 6)).includes('classes-6-10'));
    assert.equal(getProgramme('nope'), undefined);
  });
});

describe('buildWhatsAppUrl', () => {
  it('returns null without a valid number (no invented destination)', () => {
    assert.equal(buildWhatsAppUrl(undefined), null);
    assert.equal(buildWhatsAppUrl(''), null);
    assert.equal(buildWhatsAppUrl('12345'), null);
    assert.equal(buildWhatsAppUrl('0091 98765 43210'), null);
    assert.equal(buildWhatsAppUrl('91abc'), null);
  });
  it('normalises the number and encodes the message', () => {
    const url = buildWhatsAppUrl('+91 98765-43210', 'Hello & welcome? 100%');
    assert.equal(url, 'https://wa.me/919876543210?text=Hello%20%26%20welcome%3F%20100%25');
    assert.equal(buildWhatsAppUrl('919876543210'), 'https://wa.me/919876543210');
  });
  it('keeps literal plus signs encoded and limits message length', () => {
    assert.equal(
      buildWhatsAppUrl('919876543210', 'C++'),
      'https://wa.me/919876543210?text=C%2B%2B',
    );
    const url = buildWhatsAppUrl('919876543210', 'x'.repeat(2000))!;
    assert.ok(new URL(url).searchParams.get('text')!.length <= 500);
  });
  it('builds a neutral prefilled message without personal data', () => {
    assert.equal(
      whatsAppEnquiryMessage('the Urdu Language course'),
      'Hello, I would like to know more about the Urdu Language course at ASRA Academy.',
    );
  });
  it('WhatsAppLink renders nothing when no number is configured', () => {
    assert.equal(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '', '');
    assert.equal(html(<WhatsAppLink topic="admission" />), '');
  });
});

describe('enquirySchema (shared with the future enquiries API)', () => {
  const valid = {
    fullName: 'Test Student',
    email: ' Student@Example.COM ',
    phone: '',
    topic: 'english',
    message: 'I would like to know about batch timings.',
  };
  it('accepts a valid enquiry and normalises it', () => {
    const result = enquirySchema.parse(valid);
    assert.equal(result.email, 'student@example.com');
    assert.equal(result.phone, undefined);
  });
  it('validates phone numbers when given', () => {
    assert.ok(enquirySchema.safeParse({ ...valid, phone: '+91 98765 43210' }).success);
    assert.ok(!enquirySchema.safeParse({ ...valid, phone: '12' }).success);
    assert.ok(!enquirySchema.safeParse({ ...valid, phone: 'call me' }).success);
  });
  it('rejects invalid fields, unknown topics and extra keys', () => {
    assert.ok(!enquirySchema.safeParse({ ...valid, email: 'nope' }).success);
    assert.ok(!enquirySchema.safeParse({ ...valid, message: 'hi' }).success);
    assert.ok(!enquirySchema.safeParse({ ...valid, topic: 'hindi' }).success);
    assert.ok(!enquirySchema.safeParse({ ...valid, role: 'ADMIN' }).success);
  });
  it('has a label for every topic', () => {
    assert.equal(ENQUIRY_TOPIC_LABELS['quranic-studies'], 'Quranic Studies');
    assert.equal(ENQUIRY_TOPIC_LABELS.admission, 'Admission and enrolment');
    assert.ok(isEnquiryTopic('classes-6-10'));
    assert.ok(!isEnquiryTopic('constructor'));
  });
});

describe('buildEnquiryMailto', () => {
  it('addresses the confirmed email and encodes subject and body', () => {
    const href = buildEnquiryMailto(
      enquirySchema.parse({
        fullName: 'A & B',
        email: 'a@example.com',
        phone: '',
        topic: 'admission',
        message: 'Question? Yes & no.',
      }),
      'asraacademy1@gmail.com',
    );
    assert.ok(href.startsWith('mailto:asraacademy1@gmail.com?subject='));
    const url = new URL(href);
    assert.equal(url.searchParams.get('subject'), 'Website enquiry: Admission and enrolment');
    const body = url.searchParams.get('body')!;
    assert.match(body, /^Question\? Yes & no\./);
    assert.match(body, /Name: A & B/);
    assert.doesNotMatch(body, /Phone:/);
    assert.doesNotMatch(href, /\+/);
  });
});

describe('SEO helpers', () => {
  it('builds canonical, Open Graph and Twitter metadata per page', () => {
    const meta = buildPageMetadata({ title: 'Courses', description: 'D', path: '/courses' });
    assert.equal(meta.title, 'Courses');
    assert.deepEqual(meta.alternates, { canonical: '/courses' });
    assert.equal((meta.openGraph as { url: string }).url, '/courses');
    assert.equal((meta.openGraph as { title: string }).title, 'Courses | ASRA Academy');
    assert.equal(meta.robots, undefined);
  });
  it('supports absolute titles and noindex', () => {
    const meta = buildPageMetadata({
      title: 'Home',
      description: 'D',
      path: '/',
      absoluteTitle: true,
      noIndex: true,
    });
    assert.deepEqual(meta.title, { absolute: 'Home' });
    assert.deepEqual(meta.robots, { index: false, follow: true });
  });
  it('uses unique titles and descriptions for every programme', () => {
    const titles = new Set(programmes.map((programme) => programme.seo.title));
    const descriptions = new Set(programmes.map((programme) => programme.seo.description));
    assert.equal(titles.size, programmes.length);
    assert.equal(descriptions.size, programmes.length);
  });
  it('escapes "<" in JSON-LD', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    assert.doesNotMatch(out, /<\/script>/);
    assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>' });
  });
  it('emits only confirmed organisation facts', () => {
    const org = organizationJsonLd();
    assert.equal(org.email, 'asraacademy1@gmail.com');
    for (const key of ['address', 'telephone', 'sameAs', 'aggregateRating', 'foundingDate']) {
      assert.ok(!(key in org), `${key} must not be claimed`);
    }
  });
  it('numbers breadcrumb items and resolves URLs on the canonical origin', () => {
    const data = breadcrumbJsonLd(
      [{ label: 'Home', href: '/' }, { label: 'Courses', href: '/courses' }, { label: 'Urdu' }],
      '/courses/urdu',
    );
    assert.deepEqual(
      data.itemListElement.map((item) => [item.position, item.item]),
      [
        [1, absoluteUrl('/')],
        [2, absoluteUrl('/courses')],
        [3, absoluteUrl('/courses/urdu')],
      ],
    );
  });
});

describe('sitemap and robots', () => {
  it('lists every required public page except the empty blog, and no account pages', () => {
    const paths = getIndexablePaths();
    for (const route of REQUIRED_ROUTES.filter((route) => route !== '/blog')) {
      assert.ok(paths.includes(route), `${route} missing from sitemap`);
    }
    for (const excluded of ['/blog', '/login', '/register', '/design-system']) {
      assert.ok(!paths.includes(excluded), `${excluded} must not be in the sitemap`);
    }
    assert.equal(new Set(paths).size, paths.length);
  });
  it('emits absolute URLs on the configured origin', async () => {
    // No API in unit tests: the sitemap falls back to the static pages.
    const entries = await sitemap();
    assert.ok(entries.length >= getIndexablePaths().length);
    assert.ok(entries.every((entry) => entry.url.startsWith(absoluteUrl('/'))));
  });
  it('disallows everything unless indexing is enabled', () => {
    const previous = process.env.SITE_INDEXING_ENABLED;
    try {
      delete process.env.SITE_INDEXING_ENABLED;
      assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } });
      process.env.SITE_INDEXING_ENABLED = 'true';
      const enabled = robots();
      assert.deepEqual(enabled.rules, {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/student', '/faculty/', '/design-system'],
      });
      assert.equal(enabled.sitemap, absoluteUrl('/sitemap.xml'));
    } finally {
      if (previous === undefined) delete process.env.SITE_INDEXING_ENABLED;
      else process.env.SITE_INDEXING_ENABLED = previous;
    }
  });
  // PHASE 15 (QA-DEF-02): robots rules are prefix matches; `/faculty` (public page) was blocked.
  it('never disallows a page the sitemap submits, but still covers every portal', () => {
    const blocked = (path: string) =>
      PRIVATE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
    assert.deepEqual(getIndexablePaths().filter(blocked), []);
    for (const portal of [
      '/admin',
      '/student/dashboard',
      '/faculty/dashboard',
      '/faculty/courses',
    ]) {
      assert.ok(blocked(portal), `${portal} must stay disallowed`);
    }
  });
});

describe('navigation integrity', () => {
  const allLinks = [
    ...publicNavigation.flatMap((item) => [item, ...(item.children ?? [])]),
    ...footerNavigation.flatMap((column) => column.links),
    ...legalNavigation,
  ];
  it('every required route has a page', () => {
    for (const route of [...REQUIRED_ROUTES, '/login']) {
      assert.ok(routeExists(route), `no page for ${route}`);
    }
  });
  it('every navigation link points at an existing page (no dead links)', () => {
    for (const link of allLinks) assert.ok(routeExists(link.href), `dead link: ${link.href}`);
  });
  it('marks the Courses parent active on course and class pages', () => {
    const courses = publicNavigation.find((item) => item.label === 'Courses')!;
    assert.ok(isActiveNavItem('/courses/english', courses));
    assert.ok(isActiveNavItem('/classes/6-10', courses));
    assert.ok(!isActiveNavItem('/about', courses));
  });
});

describe('public page components', () => {
  it('EmptyState renders a heading, description and action', () => {
    const out = html(
      <EmptyState
        title="No articles yet"
        description="Check back later."
        action={<a href="#x">Go</a>}
      />,
    );
    assert.match(out, /<h2[^>]*>No articles yet<\/h2>/);
    assert.match(out, /Check back later\./);
  });
  it('legal pages say they are pending approval and contain no commitments', () => {
    for (const document of Object.values(legalDocuments)) {
      assert.equal(document.status, 'pending-approval');
      const out = html(<LegalPage document={document} />);
      assert.match(out, /Draft outline — pending approval/);
      assert.match(out, /not a legally binding policy/);
      assert.match(out, /<h1[^>]*>[^<]*<\/h1>/);
      assert.doesNotMatch(out, /\b\d+\s*(days?|months?|years?)\b/i);
    }
  });
  it('programme grid links each card to its page', () => {
    const out = html(<ProgrammeGrid items={programmes} />);
    for (const programme of programmes) assert.match(out, new RegExp(`href="${programme.href}"`));
  });
  it('programme pages flag provisional subjects and never invent fees or faculty', () => {
    const out = html(<ProgrammePage programme={getProgramme('classes-11-12')!} />);
    assert.match(out, /<h1[^>]*>Classes 11–12<\/h1>/);
    assert.match(out, /Subject list to be confirmed/);
    assert.match(out, /To be announced/);
    assert.match(out, /Faculty profiles coming soon/);
    assert.match(out, /href="\/contact\?topic=classes-11-12"/);
    assert.doesNotMatch(out, /₹|wa\.me/);
    assert.equal((out.match(/<h1/g) ?? []).length, 1);
  });
});
