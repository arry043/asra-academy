import { CtaBand } from '@/components/public/cta-band';
import { JsonLd } from '@/components/public/json-ld';
import { buildPageMetadata, organizationJsonLd, websiteJsonLd } from '@/lib/seo';

import {
  CoursesShowcase,
  FacultySection,
  HomeHero,
  LearningProcess,
  LiveClassesSection,
  PlatformHighlights,
  TestimonialsSection,
  WhyAsra,
} from './_home/sections';

export const metadata = buildPageMetadata({
  title: 'ASRA Academy — Quality Education for a Brighter Tomorrow',
  absoluteTitle: true,
  description:
    'Online learning with ASRA Academy: CBSE-pattern Classes 6–10, Classes 11–12 coaching, English, Arabic and Urdu, Quranic Studies, and Entrepreneurship & Business.',
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <HomeHero />
      <PlatformHighlights />
      <CoursesShowcase />
      <WhyAsra />
      <LiveClassesSection />
      <FacultySection />
      <LearningProcess />
      <TestimonialsSection />
      <CtaBand />
    </>
  );
}
