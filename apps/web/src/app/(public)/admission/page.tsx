import Link from 'next/link';

import { CourseCategoryCard } from '@/components/asra/categories/course-category-card';
import { Section } from '@/components/layout/section';
import { CtaBand } from '@/components/public/cta-band';
import { LearningSteps } from '@/components/public/learning-steps';
import { PageHero } from '@/components/public/page-hero';
import { getProgrammeVisual } from '@/components/public/programme-visuals';
import { WhatsAppLink } from '@/components/public/whatsapp-link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { programmes } from '@/content/programmes';
import { siteConfig } from '@/config/site';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Admission and enrolment',
  description:
    'How to join ASRA Academy: explore programmes, send an admission enquiry, create a student account and enrol in Classes 6–12 or a special course.',
  path: '/admission',
});

/*
 * No admission application, approval or payment workflow exists yet (PHASE 10), and the rules
 * are pending (CLIENT-CLARIFICATIONS D-04, M-01, Y-02). The next step offered here is therefore a
 * real enquiry route — nothing on this page simulates an application being submitted.
 */
export default function AdmissionPage() {
  return (
    <>
      <PageHero
        path="/admission"
        breadcrumbs={[{ label: 'Admission' }]}
        eyebrow="Admission"
        title="Admission and enrolment"
        description={
          <p>
            Joining ASRA Academy starts with a conversation. Explore our programmes and send us an
            admission enquiry — no account is needed to get started.
          </p>
        }
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/contact?topic=admission">Send an admission enquiry</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/courses">Explore courses</Link>
            </Button>
            <WhatsAppLink topic="admission" size="lg" />
          </>
        }
      />

      <Section
        eyebrow="Step by step"
        title="How admission works"
        description="Four steps from your first question to your first class."
      >
        <LearningSteps />
        <Alert tone="info" title="Admission details are being finalised">
          <p>
            Eligibility, required documents, batch timings and fees for each class and course will
            be published once confirmed by the academy. Until then, email{' '}
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="font-semibold underline underline-offset-2"
            >
              {siteConfig.contact.email}
            </a>{' '}
            or{' '}
            <Link
              href="/contact?topic=admission"
              className="font-semibold underline underline-offset-2"
            >
              send an enquiry
            </Link>{' '}
            for the latest information.
          </p>
        </Alert>
      </Section>

      <Section
        tone="muted"
        eyebrow="Choose a programme"
        title="Which class or course are you interested in?"
        description="Open a programme to see what it covers, then enquire about admission."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {programmes.map((programme) => (
            <li key={programme.slug}>
              <CourseCategoryCard
                name={programme.title}
                href={programme.href}
                {...getProgrammeVisual(programme.slug)}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Already have an account?"
        description="Students who have registered can sign in to the ASRA Academy platform. New students can create an account at any time."
        containerSize="narrow"
        align="center"
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/login">Student login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Create an account</Link>
          </Button>
        </div>
      </Section>

      <CtaBand
        title="Ready to take the next step?"
        primary={{ label: 'Send an admission enquiry', href: '/contact?topic=admission' }}
        secondary={{ label: 'Explore courses', href: '/courses' }}
        tertiary={null}
        whatsAppTopic="admission"
      />
    </>
  );
}
