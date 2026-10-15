import { Users } from 'lucide-react';
import Link from 'next/link';

import { FacultyCard } from '@/components/asra/faculty/faculty-card';
import { Container } from '@/components/layout/container';
import { CtaBand } from '@/components/public/cta-band';
import { EmptyState } from '@/components/public/empty-state';
import { PageHero } from '@/components/public/page-hero';
import { Button } from '@/components/ui/button';
import { publicFaculty } from '@/content/faculty';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Faculty',
  description:
    'Meet the teachers of ASRA Academy. Faculty profiles for school classes and special courses are published here.',
  path: '/faculty',
});

export default function FacultyPage() {
  const faculty = publicFaculty;

  return (
    <>
      <PageHero
        path="/faculty"
        breadcrumbs={[{ label: 'Faculty' }]}
        eyebrow="Faculty"
        title="Our faculty"
        description={
          <p>
            ASRA Academy&apos;s teachers guide students through their allocated subjects — from
            lectures and notes to live classes and assessments.
          </p>
        }
      />

      <Container className="py-section">
        {faculty.length > 0 ? (
          <section aria-labelledby="faculty-list-title" className="grid gap-6">
            <h2 id="faculty-list-title" className="type-h2 text-heading">
              Faculty members
            </h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {faculty.map((member) => (
                <li key={member.name}>
                  <FacultyCard {...member} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState
            icon={<Users />}
            title="Faculty profiles will be published soon"
            description="We are preparing introductions to ASRA Academy's teachers. In the meantime, you are welcome to ask us about the faculty for a particular class or course."
            action={
              <>
                <Button asChild>
                  <Link href="/contact?topic=general">Ask about our faculty</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/courses">Explore courses</Link>
                </Button>
              </>
            }
          />
        )}
      </Container>

      <CtaBand />
    </>
  );
}
