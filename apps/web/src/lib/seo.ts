import type { Metadata } from 'next';

import { siteConfig } from '@/config/site';
import { publicEnv } from '@/lib/env';

/**
 * SEO helpers for the public website.
 *
 * The canonical origin is `NEXT_PUBLIC_APP_URL` (also the root `metadataBase`). Production must set
 * it to the live domain — www.asraacademy.in per the Project Development Order, once DNS is
 * handed over (CLIENT-CLARIFICATIONS W-04). Nothing here hard-codes a production domain.
 */

/** Absolute URL on the canonical origin for a site path ("/courses" → "https://…/courses"). */
export function absoluteUrl(path = '/'): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_APP_URL).toString();
}

type PageMetadataInput = {
  /** Page title; the root template appends " | ASRA Academy". */
  title: string;
  description: string;
  /** Site path of the canonical URL, e.g. "/courses/english". */
  path: string;
  /** Use the title as-is, without the site-name template (homepage). */
  absoluteTitle?: boolean;
  /** Keep this page out of search indexes (thin or placeholder pages). */
  noIndex?: boolean;
};

/**
 * Page metadata with a canonical URL and matching Open Graph / Twitter tags. Next.js merges
 * `openGraph` shallowly, so the shared image and site name are repeated here on purpose.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      locale: 'en_IN',
      url: path,
      title: fullTitle,
      description,
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [siteConfig.ogImage],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/**
 * schema.org data built ONLY from confirmed facts (name, website, logo, tagline, email,
 * founding statement). No address, phone, social profiles, ratings or prices are claimed.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: siteConfig.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl(siteConfig.logo.full.src),
    slogan: siteConfig.tagline,
    description: siteConfig.description,
    email: siteConfig.contact.email,
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: absoluteUrl('/'),
    inLanguage: 'en-IN',
  };
}

/** BreadcrumbList matching the visible breadcrumb trail (the current page has no `href`). */
export function breadcrumbJsonLd(items: BreadcrumbItem[], currentPath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.href ?? currentPath),
    })),
  };
}

/**
 * Serialises JSON-LD for a `<script type="application/ld+json">` tag. `<` is escaped so text can
 * never close the script element (e.g. a future CMS title containing "</script>").
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
