import type { Paginated, PublicJobListItemDto } from '@asra/types';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { CareersDirectory } from '@/components/public/careers/careers-directory';
import { CareersWhyUs } from '@/components/public/careers/careers-why-us';
import { CtaBand } from '@/components/public/cta-band';
import { PageHero } from '@/components/public/page-hero';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Careers',
  description:
    'Explore rewarding careers at ASRA Academy. Join our community of dedicated educators, scholars, and staff committed to holistic, faith-rooted education.',
  path: '/careers',
});

export const dynamic = 'force-dynamic';

interface CareersPageProps {
  searchParams?: Promise<{
    category?: string;
    department?: string;
    search?: string;
  }>;
}

export default async function CareersPage({ searchParams }: CareersPageProps) {
  const params = await searchParams;
  const initialCategory = typeof params?.category === 'string' ? params.category : undefined;
  let jobs: PublicJobListItemDto[] = [];

  try {
    const res = await apiRequest<Paginated<PublicJobListItemDto>>('/careers?limit=50');
    jobs = res?.items ?? [];
  } catch (err) {
    // Graceful fallback if API is temporarily unavailable
    console.error('Failed to fetch public careers:', err);
    jobs = [];
  }

  return (
    <>
      <PageHero
        path="/careers"
        breadcrumbs={[{ label: 'Careers' }]}
        eyebrow="Join Our Team"
        title="Shape the Future of Education with ASRA Academy"
        description={
          <p>
            We are looking for passionate, innovative educators and professionals who inspire
            excellence, nurture character, and build a brighter future for our students.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-4 pt-2">
            <Button asChild size="lg">
              <a href="#openings">
                Explore Openings <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">About Our Mission</Link>
            </Button>
          </div>
        }
      />

      {/* Why Work With Us */}
      <CareersWhyUs />

      {/* Available Job Openings */}
      <CareersDirectory
        initialJobs={jobs}
        initialCategory={initialCategory}
        serverTime={new Date().toISOString()}
      />

      {/* Footer Callout */}
      <CtaBand
        title="Need Assistance with Your Application?"
        description="Our recruitment and human resources team is here to assist with any queries regarding open positions, qualifications, or hiring timelines."
        primary={{ label: 'Contact HR Team', href: '/contact' }}
        secondary={{ label: 'About ASRA Academy', href: '/about' }}
        tertiary={null}
      />
    </>
  );
}
