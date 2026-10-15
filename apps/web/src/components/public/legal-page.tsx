import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { PageHero } from '@/components/public/page-hero';
import { Alert } from '@/components/ui/alert';
import { siteConfig } from '@/config/site';
import type { LegalDocument } from '@/content/legal';
import { legalNavigation } from '@/config/navigation';
import { formatDate } from '@/lib/format';

/**
 * Shared layout for the Privacy Policy, Terms and Refund Policy. While a document is pending
 * approval, the page says so prominently and lists only the topics it will cover.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  const pending = document.status === 'pending-approval';
  const effective = formatDate(document.effectiveDate);
  const otherDocuments = legalNavigation.filter((link) => link.href !== document.path);

  return (
    <>
      <PageHero
        title={document.title}
        eyebrow="Legal"
        path={document.path}
        breadcrumbs={[{ label: document.title }]}
        description={document.summary}
      />

      <Container size="prose" className="grid gap-10 py-section">
        {pending ? (
          <Alert tone="warning" title="Draft outline — pending approval">
            <p>
              The approved {document.title.toLowerCase()} has not been published yet. This page
              lists the topics it will cover; it is not a legally binding policy. For questions in
              the meantime, email{' '}
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="font-semibold underline underline-offset-2"
              >
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </Alert>
        ) : effective ? (
          <p className="type-body-sm text-muted-foreground">Effective from {effective}</p>
        ) : null}

        <div className="grid gap-8">
          {document.sections.map((section, index) => (
            <section key={section.heading} className="grid gap-2">
              <h2 className="type-h3 text-heading">
                {index + 1}. {section.heading}
              </h2>
              <p className="type-body text-muted-foreground">
                {pending ? `To be covered: ${section.covers}` : section.covers}
              </p>
            </section>
          ))}
        </div>

        <nav aria-label="Other policies" className="border-t pt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 type-body-sm">
            {otherDocuments.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </>
  );
}
