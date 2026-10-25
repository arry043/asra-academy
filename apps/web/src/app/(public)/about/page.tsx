import { BookOpenText, GraduationCap, Layers, MonitorSmartphone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { FeatureCard } from '@/components/asra/features/feature-card';
import { Section } from '@/components/layout/section';
import { CtaBand } from '@/components/public/cta-band';
import { PageHero } from '@/components/public/page-hero';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { getProgrammesByKind } from '@/lib/programmes';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'About ASRA Academy',
  description:
    'ASRA Academy is an online academy founded by students of AMU, combining school education, language development, entrepreneurship and Quranic Studies in one place.',
  path: '/about',
});

/*
 * Content sources: Project Development Order §1 (objective), §2 (programmes) and §8 (vision);
 * brand details confirmed 2026-10-12. Founding year, leadership, history, accreditation and
 * statistics are NOT confirmed and are deliberately absent (CLIENT-CLARIFICATIONS T-02, Y-01).
 */
const APPROACH = [
  {
    icon: <Layers />,
    title: 'Everything in one place',
    description:
      'School education, language development, entrepreneurship and Quranic Studies on a single platform.',
  },
  {
    icon: <BookOpenText />,
    title: 'Structured learning',
    description:
      'School subjects follow a chapter-wise path of lectures, notes, assignments, practice questions and examinations.',
  },
  {
    icon: <MonitorSmartphone />,
    title: 'Accessible and user-friendly',
    description:
      'Simple, student-friendly pages that work on mobile phones, tablets and computers.',
  },
  {
    icon: <GraduationCap />,
    title: 'Room to grow',
    description:
      'Built to add new courses, languages and faculty as the academy grows across India.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        path="/about"
        breadcrumbs={[{ label: 'About' }]}
        eyebrow="About us"
        title="About ASRA Academy"
        description={
          <p>
            ASRA Academy is an online academy that brings school education, language development,
            entrepreneurship and Quranic Studies together in one place.
          </p>
        }
      />

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-5 type-body-lg text-foreground">
            <h2 className="type-h2 text-heading">Our purpose</h2>
            <p>
              ASRA Academy aims to build a comprehensive digital learning platform that combines
              school education, language development, entrepreneurship and Quranic Studies — and to
              keep growing its courses, faculty and reach over time.
            </p>
            <p>
              The academy wants learning to be accessible on everyday devices, affordable and simple
              to use, for students across India.
            </p>
            <p className="font-medium text-asra-green-700">
              {siteConfig.foundedBy}. Our motto: {siteConfig.tagline}.
            </p>
          </div>
          <div className="mx-auto w-full max-w-xs rounded-[2rem] bg-asra-warm-white p-10 shadow-raised ring-1 ring-asra-gold-500/30">
            <Image
              src={siteConfig.logo.full.src}
              width={siteConfig.logo.full.width}
              height={siteConfig.logo.full.height}
              alt={siteConfig.logo.alt}
              // max-w-xs (20rem) minus p-10 padding.
              sizes="15rem"
              className="h-auto w-full"
            />
          </div>
        </div>
      </Section>

      <Section tone="muted" eyebrow="Our approach" title="How ASRA Academy approaches learning">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {APPROACH.map((item) => (
            <li key={item.title}>
              <FeatureCard icon={item.icon} title={item.title} description={item.description} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="What we teach"
        title="School education"
        description="Classes 6–10 follow the CBSE-pattern curriculum; Classes 11–12 receive subject-specific coaching for the applicable academic streams."
      >
        <ProgrammeGrid items={getProgrammesByKind('class-band')} />
      </Section>

      <Section
        tone="muted"
        title="Special courses"
        description="Language, business and Quranic Studies courses — with more academic, professional and skill-development courses planned for the future."
        action={
          <Button asChild variant="outline">
            <Link href="/courses">Browse all courses</Link>
          </Button>
        }
      >
        <ProgrammeGrid items={getProgrammesByKind('special-course')} />
      </Section>

      <Section
        eyebrow="Faculty"
        title="Our teachers"
        description="ASRA's faculty teach and guide students in their allocated subjects through lectures, notes, live classes and assessments. Their profiles will be published on the faculty page."
        action={
          <Button asChild variant="outline">
            <Link href="/faculty">Visit the faculty page</Link>
          </Button>
        }
      />

      <CtaBand />
    </>
  );
}
