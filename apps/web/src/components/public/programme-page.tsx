import { Users } from 'lucide-react';
import Link from 'next/link';

import { Section } from '@/components/layout/section';
import { CheckList } from '@/components/public/check-list';
import { CtaBand } from '@/components/public/cta-band';
import { EmptyState } from '@/components/public/empty-state';
import { JsonLd } from '@/components/public/json-ld';
import { PageHero } from '@/components/public/page-hero';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { WhatsAppLink } from '@/components/public/whatsapp-link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROGRAMME_CATEGORIES, type Programme } from '@/content/programmes';
import { getRelatedProgrammes } from '@/lib/programmes';
import { courseJsonLd } from '@/lib/seo';

/**
 * One template for every programme page — the two class bands and the five special courses — so
 * they stay consistent and are edited through `content/programmes.ts`, not repeated JSX.
 *
 * Shows only confirmed content. Fees, duration, levels, batches, schedules, eligibility and
 * faculty are not confirmed (CLIENT-CLARIFICATIONS A-01/A-02, B-01–B-04, C-01), so the page says
 * they will be announced and points to a real enquiry route instead of inventing values.
 */
export function ProgrammePage({ programme }: { programme: Programme }) {
  const isClassBand = programme.kind === 'class-band';
  const related = getRelatedProgrammes(programme.slug, 3);
  const enquiryHref = `/contact?topic=${programme.slug}`;
  const topicLabel = isClassBand ? programme.title : `the ${programme.title} course`;

  return (
    <>
      {/* A class band is a group of classes, not one course, so only special courses are marked up. */}
      {isClassBand ? null : (
        <JsonLd
          data={courseJsonLd({
            name: programme.title,
            description: programme.summary,
            path: programme.href,
          })}
        />
      )}
      <PageHero
        path={programme.href}
        breadcrumbs={[{ label: 'Courses', href: '/courses' }, { label: programme.title }]}
        eyebrow={PROGRAMME_CATEGORIES[programme.category]}
        title={programme.title}
        description={
          <div className="grid gap-3">
            {programme.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        }
        actions={
          <>
            <Button asChild size="lg">
              <Link href={enquiryHref}>
                {isClassBand ? 'Enquire about these classes' : 'Enquire about this course'}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/admission">Admission</Link>
            </Button>
            <WhatsAppLink topic={topicLabel} size="lg" />
          </>
        }
        aside={
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="mb-4 type-h4 text-heading">At a glance</h2>
            <dl className="grid gap-3 type-body-sm">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium text-foreground">
                  {PROGRAMME_CATEGORIES[programme.category]}
                </dd>
              </div>
              {programme.curriculum ? (
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">Curriculum</dt>
                  <dd className="font-medium text-foreground">{programme.curriculum}</dd>
                </div>
              ) : null}
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium text-foreground">Online</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">
                  {isClassBand ? 'Batches, timings and fees' : 'Levels, duration, batches and fees'}
                </dt>
                <dd className="font-medium text-foreground">
                  To be announced —{' '}
                  <Link
                    href={enquiryHref}
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    ask the academy
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        }
      />

      <Section title={programme.topicsHeading} containerSize="narrow">
        <CheckList items={programme.topics} columns={2} />
      </Section>

      {programme.candidateSubjects?.length ? (
        <Section
          tone="muted"
          title="Subjects"
          description="Subjects that may be offered at this stage of school education."
          containerSize="narrow"
        >
          <ul className="flex flex-wrap gap-2" aria-label={`Subjects for ${programme.title}`}>
            {programme.candidateSubjects.map((subject) => (
              <li key={subject}>
                <Badge className="px-3 py-1 type-body-sm">{subject}</Badge>
              </li>
            ))}
          </ul>
          <Alert tone="info" title="Subject list to be confirmed">
            <p>
              The final subject list will be confirmed by ASRA Academy according to class,
              {programme.slug === 'classes-11-12' ? ' academic stream' : ' stream'} and faculty
              availability.
              {programme.slug === 'classes-11-12'
                ? ' Stream details for Classes 11–12 will be published once confirmed.'
                : ''}{' '}
              <Link href={enquiryHref} className="font-semibold underline underline-offset-2">
                Ask about a specific subject
              </Link>
              .
            </p>
          </Alert>
        </Section>
      ) : null}

      <Section
        title="Faculty"
        containerSize="narrow"
        tone={programme.candidateSubjects?.length ? 'default' : 'muted'}
      >
        <EmptyState
          icon={<Users />}
          headingLevel="h3"
          title="Faculty profiles coming soon"
          description={`The teachers for ${isClassBand ? 'these classes' : 'this course'} will be introduced on the faculty page once their profiles are published.`}
          action={
            <Button asChild variant="outline">
              <Link href="/faculty">Visit the faculty page</Link>
            </Button>
          }
        />
      </Section>

      <Section
        tone={programme.candidateSubjects?.length ? 'muted' : 'default'}
        eyebrow="Keep exploring"
        title="Related courses"
        action={
          <Button asChild variant="outline">
            <Link href="/courses">View all courses</Link>
          </Button>
        }
      >
        <ProgrammeGrid items={related} />
      </Section>

      <CtaBand
        title={`Interested in ${programme.title}?`}
        description="Ask about availability, timings and fees, or read how admission works."
        whatsAppTopic={topicLabel}
        primary={{ label: 'Send an enquiry', href: enquiryHref }}
        secondary={{ label: 'Admission', href: '/admission' }}
        tertiary={{ label: 'All courses', href: '/courses' }}
      />
    </>
  );
}
