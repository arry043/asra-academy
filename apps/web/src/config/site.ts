/**
 * ASRA Academy brand & contact details — single source of truth for the web app.
 * Confirmed by the client on 2026-10-12 (see docs/CHANGELOG.md 0.1.1).
 */
export const siteConfig = {
  name: 'ASRA Academy',
  shortName: 'ASRA',
  tagline: 'Learn • Grow • Succeed',
  foundedBy: 'Founded by students of AMU',
  description:
    'ASRA Academy — online learning for Classes 6–12 (CBSE pattern), English Language, Entrepreneurship & Business, Quranic Studies, Arabic and Urdu.',
  contact: {
    email: 'asraacademy1@gmail.com',
  },
  website: 'https://www.asraacademy.in',
  logo: {
    full: { src: '/brand/asra-academy-logo.png', width: 1007, height: 1126 },
    emblem: { src: '/brand/asra-academy-emblem.png', width: 512, height: 512 },
    alt: 'ASRA Academy — Learn • Grow • Succeed',
  },
  ogImage: {
    url: '/brand/og-image.png',
    width: 1200,
    height: 630,
    alt: 'ASRA Academy logo — Learn • Grow • Succeed',
  },
  /** Colours sampled from the supplied logo (docs/brand/README.md). */
  colors: {
    green: '#012114',
    gold: '#c88717',
    ivory: '#fdfbf5',
  },
} as const;
