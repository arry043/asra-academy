import Link from 'next/link';

import { BrandMark } from '@/components/layout/brand-mark';
import { Container } from '@/components/layout/container';
import { SkipLink } from '@/components/layout/skip-link';
import { Alert } from '@/components/ui/alert';

import { BrandSection } from './_sections/brand-section';
import { CoreSection } from './_sections/core-section';
import { EducationSection } from './_sections/education-section';
import { LayoutsSection } from './_sections/layouts-section';
import { MotionSection } from './_sections/motion-section';
import { ResponsiveSection } from './_sections/responsive-section';

export const metadata = { title: 'Showcase' };

const TOC = [
  { href: '#brand', label: 'Brand' },
  { href: '#components', label: 'Components' },
  { href: '#education', label: 'Education' },
  { href: '#layouts', label: 'Layouts' },
  { href: '#motion', label: 'Motion' },
  { href: '#responsive', label: 'Responsive' },
] as const;

/**
 * Internal design-system showcase (PHASE 04). Gated by ./layout.tsx. Demo data only.
 * The `page` search param drives the link-mode pagination example.
 */
export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const linkPage = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 5 ? rawPage : 1;

  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-40 border-b bg-asra-warm-white">
        <Container className="flex h-topbar items-center gap-4">
          <BrandMark />
          <nav
            aria-label="Showcase sections"
            className="ml-auto hidden min-w-0 [scrollbar-width:none] overflow-x-auto md:block"
          >
            <ul className="flex gap-1">
              {TOC.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex h-control-sm items-center rounded-full px-3 type-label whitespace-nowrap text-foreground transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <Container className="grid gap-5 pt-10 pb-4 sm:pt-14">
          <p className="type-eyebrow text-asra-gold-800">Phase 04 · Internal</p>
          <h1 className="max-w-3xl type-display text-heading">ASRA Academy design system</h1>
          <p className="max-w-2xl type-body-lg text-muted-foreground">
            Tokens, components, education cards, layouts and motion for every ASRA Academy screen.
            Built from the official logo and the client&apos;s visual reference.
          </p>
          <Alert tone="info" title="Demo data only" className="max-w-2xl">
            <p>
              People, quotes, dates and figures on this page are placeholders marked “(demo)”. See{' '}
              <Link href="#layouts" className="font-medium underline underline-offset-4">
                Layouts
              </Link>{' '}
              for the dashboard previews. Documentation: <code>docs/DESIGN-SYSTEM.md</code>.
            </p>
          </Alert>
        </Container>

        <BrandSection />
        <CoreSection linkPage={linkPage} />
        <EducationSection />
        <LayoutsSection />
        <MotionSection />
        <ResponsiveSection />
      </main>
    </>
  );
}
