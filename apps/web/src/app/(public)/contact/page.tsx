import { BookOpen, GraduationCap, Mail } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { ContactForm } from '@/components/public/contact-form';
import { PageHero } from '@/components/public/page-hero';
import { isWhatsAppConfigured, WhatsAppLink } from '@/components/public/whatsapp-link';
import { siteConfig } from '@/config/site';
import { isEnquiryTopic } from '@/lib/enquiry';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Contact us',
  description:
    'Contact ASRA Academy with questions about classes, courses or admission. Email asraacademy1@gmail.com or use the enquiry form.',
  path: '/contact',
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Contact details shown here are ONLY the client-confirmed email and, when configured, the
 * WhatsApp number. No phone number, address or social profile is confirmed (Y-03), so none is
 * shown. `?topic=` (from course and admission pages) preselects the enquiry topic.
 */
export default async function ContactPage({ searchParams }: Props) {
  const { topic } = await searchParams;
  const defaultTopic = isEnquiryTopic(topic) ? topic : undefined;
  const whatsApp = isWhatsAppConfigured();

  return (
    <>
      <PageHero
        path="/contact"
        breadcrumbs={[{ label: 'Contact' }]}
        eyebrow="Contact"
        title="Contact ASRA Academy"
        description={
          <p>
            Have a question about classes, courses or admission? Write to us and the academy will
            get back to you.
          </p>
        }
      />

      <Container className="grid gap-10 py-section lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="enquiry-form-title"
          className="grid gap-6 rounded-2xl border bg-card p-5 shadow-card sm:p-8"
        >
          <div className="grid gap-2">
            <h2 id="enquiry-form-title" className="type-h2 text-heading">
              Send an enquiry
            </h2>
            <p className="type-body text-muted-foreground">
              All fields are required unless marked optional.
            </p>
          </div>
          <ContactForm recipient={siteConfig.contact.email} defaultTopic={defaultTopic} />
        </section>

        <aside aria-labelledby="contact-details-title" className="grid content-start gap-4">
          <h2 id="contact-details-title" className="type-h3 text-heading">
            Other ways to reach us
          </h2>
          <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 type-label text-heading">
              <Mail className="size-4 text-asra-green-700" aria-hidden /> Email
            </p>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="type-body font-semibold break-all text-primary underline-offset-4 hover:underline"
            >
              {siteConfig.contact.email}
            </a>
          </div>
          {whatsApp ? (
            <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card">
              <p className="type-label text-heading">WhatsApp</p>
              <WhatsAppLink className="w-full" />
            </div>
          ) : null}
          <nav
            aria-label="Helpful links"
            className="grid gap-2 rounded-2xl border bg-asra-green-50 p-5"
          >
            <Link
              href="/admission"
              className="flex items-center gap-2 type-body-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <GraduationCap className="size-4" aria-hidden /> How admission works
            </Link>
            <Link
              href="/courses"
              className="flex items-center gap-2 type-body-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <BookOpen className="size-4" aria-hidden /> Explore all courses
            </Link>
          </nav>
        </aside>
      </Container>
    </>
  );
}
