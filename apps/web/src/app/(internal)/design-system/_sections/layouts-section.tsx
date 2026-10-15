import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { Section } from '@/components/layout/section';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { footerNavigation, legalNavigation, publicNavigation } from '@/config/navigation';

import { Caption, ShowcaseBlock, TokenCode } from '../_components/showcase';
import { demoAdminNav, demoStudentNav } from '../_fixtures';

export function LayoutsSection() {
  return (
    <Section
      id="layouts"
      tone="muted"
      eyebrow="D · Layouts"
      title="Shared layouts"
      description="Public and authenticated shells. The public navigation links to the live Phase 05 pages."
    >
      <ShowcaseBlock
        title="Navbar"
        description="Inline links from lg (1024px); below that a menu button opens a drawer. Resize the window to see it switch."
      >
        <div className="overflow-hidden rounded-xl border shadow-card">
          <Navbar
            items={publicNavigation}
            cta={{ label: 'Login / Register', href: '/login' }}
            sticky={false}
          />
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Container & Section"
        description="Container caps width at 1216px with 16→32px gutters; Section adds vertical rhythm and a labelled heading block."
      >
        <div className="overflow-hidden rounded-xl border">
          <Section
            tone="brand"
            eyebrow="Eyebrow"
            title="Section title on the brand band"
            description="Brand bands switch text to ivory with gold accents. Use at most one per page."
            action={
              <Button variant="accent" size="sm">
                Section action
              </Button>
            }
            headingLevel="h4"
            className="py-10 sm:py-12"
          >
            <Container className="rounded-lg border border-dashed border-asra-gold-500/60 py-4 text-center type-caption text-asra-green-200">
              Nested Container (dashed outline)
            </Container>
          </Section>
        </div>
        <Caption>
          Widths: <TokenCode>max-w-page</TokenCode> 1216px · <TokenCode>max-w-narrow</TokenCode>{' '}
          896px · <TokenCode>max-w-prose-content</TokenCode> 672px
        </Caption>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Sidebar"
        description="Default and admin tones. Active item: tinted background, gold bar and aria-current."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-asra-warm-white p-3 shadow-card">
            <Sidebar groups={demoStudentNav} label="Student portal (demo)" />
          </div>
          <div className="rounded-xl bg-asra-green-900 p-3 shadow-card">
            <Sidebar groups={demoAdminNav} label="Administration (demo)" tone="admin" />
          </div>
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="DashboardLayout & AdminLayout"
        description="Full-page previews with working navigation, mobile drawer and page transitions."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/design-system/dashboard-preview">
              Dashboard preview <ExternalLink aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/design-system/admin-preview">
              Admin preview <ExternalLink aria-hidden />
            </Link>
          </Button>
        </div>
      </ShowcaseBlock>

      <ShowcaseBlock
        title="Footer"
        description="Light surface (the logo is dark-on-light only). Contact details from the confirmed site config."
      >
        <div className="overflow-hidden rounded-xl border shadow-card">
          <Footer columns={footerNavigation} legalLinks={legalNavigation} />
        </div>
      </ShowcaseBlock>
    </Section>
  );
}
