import {
  BookOpenText,
  ChartLine,
  CirclePlay,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers,
  MonitorSmartphone,
  Quote,
  Users,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { FacultyCard } from '@/components/asra/faculty/faculty-card';
import { FeatureCard } from '@/components/asra/features/feature-card';
import { LiveClassCard } from '@/components/asra/live-classes/live-class-card';
import { TestimonialCard } from '@/components/asra/testimonials/testimonial-card';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { CheckList } from '@/components/public/check-list';
import { EmptyState } from '@/components/public/empty-state';
import { LearningSteps } from '@/components/public/learning-steps';
import { ProgrammeGrid } from '@/components/public/programme-grid';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { publicFaculty } from '@/content/faculty';
import { upcomingPublicLiveClasses } from '@/content/live-classes';
import { programmes } from '@/content/programmes';
import { approvedTestimonials } from '@/content/testimonials';

/*
 * Homepage sections, in the order of the client's visual reference (PRD working notes §28):
 * Hero → Platform Highlights → Courses → Why ASRA → Live Classes → Faculty → Learning Process →
 * Testimonials → CTA. The navbar and footer come from the public layout.
 *
 * Copy rule: only facts from the Project Development Order, the confirmed brand details and the
 * reference headline. Nothing about fees, results, rankings, student numbers or accreditation.
 */

const HERO_TAGS = ['Classes 6–12', 'Languages', 'Quranic Studies', 'Entrepreneurship'];

export function HomeHero() {
  const { logo } = siteConfig;
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative overflow-hidden border-b bg-gradient-to-b from-asra-green-50 to-asra-ivory"
    >
      <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-24">
        <div className="grid justify-items-start gap-6">
          <p className="rounded-full bg-asra-gold-100 px-3 py-1 type-eyebrow text-asra-gold-800">
            {siteConfig.tagline}
          </p>
          <h1 id="home-hero-title" className="type-display text-heading">
            Quality Education for a <span className="text-asra-green-600">Brighter Tomorrow</span>
          </h1>
          <p className="max-w-xl type-body-lg text-muted-foreground">
            School education for Classes 6–12, language courses, Entrepreneurship &amp; Business and
            Quranic Studies — brought together in one online academy for students across India.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/courses">Explore courses</Link>
            </Button>
            <Button asChild size="lg" variant="accent">
              <Link href="/admission">Join now</Link>
            </Button>
          </div>
          <p className="flex items-center gap-2 type-body-sm font-medium text-asra-green-700">
            <GraduationCap className="size-4" aria-hidden />
            {siteConfig.foundedBy}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm sm:max-w-md">
          <div
            aria-hidden
            className="absolute inset-6 -z-0 rounded-[2rem] bg-asra-gold-200/50 blur-2xl"
          />
          <div className="relative flex aspect-square items-center justify-center rounded-[2rem] bg-asra-warm-white p-10 shadow-raised ring-1 ring-asra-gold-500/30 sm:p-14">
            <Image
              src={logo.full.src}
              width={logo.full.width}
              height={logo.full.height}
              alt={logo.alt}
              priority
              sizes="(min-width: 640px) 18rem, 60vw"
              className="h-auto w-3/5"
            />
          </div>
          <ul aria-label="Programme areas" className="mt-5 flex flex-wrap justify-center gap-2">
            {HERO_TAGS.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-asra-green-200 bg-card px-3 py-1.5 type-caption font-medium text-asra-green-800 shadow-card"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/** Confirmed platform capabilities (Order §3). They are requirements being built, not live today. */
const HIGHLIGHTS = [
  {
    icon: <Video />,
    title: 'Live online classes',
    description: 'Learn in real time with ASRA faculty in scheduled online classes.',
  },
  {
    icon: <CirclePlay />,
    title: 'Recorded lectures',
    description: 'Revisit lessons whenever you need to revise.',
  },
  {
    icon: <FileText />,
    title: 'Notes & study materials',
    description: 'Downloadable notes, PDFs and study materials for each subject.',
  },
  {
    icon: <ClipboardCheck />,
    title: 'Quizzes, assignments & exams',
    description: 'Online quizzes, assignments, mock tests and examinations.',
  },
  {
    icon: <ChartLine />,
    title: 'Progress & results',
    description: 'Follow your progress and see your examination results.',
  },
  {
    icon: <MonitorSmartphone />,
    title: 'Any device',
    description: 'Designed for mobile phones, tablets and computers.',
  },
];

export function PlatformHighlights() {
  return (
    <Section
      id="highlights"
      eyebrow="Platform highlights"
      title="One platform for the whole learning journey"
      description="The ASRA Academy learning platform brings classes, study materials and assessments together. Features open to enrolled students as the platform launches."
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <FeatureCard icon={item.icon} title={item.title} description={item.description} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CoursesShowcase() {
  return (
    <Section
      id="courses"
      tone="muted"
      eyebrow="Our courses"
      title="School classes and special courses"
      description="From CBSE-pattern school education to languages, entrepreneurship and Quranic Studies."
      action={
        <Button asChild variant="outline">
          <Link href="/courses">View all courses</Link>
        </Button>
      }
    >
      <ProgrammeGrid
        items={programmes}
        columns={4}
        viewAll={{
          href: '/courses',
          label: 'Find the right course',
          description: 'Search and filter every programme in one place.',
        }}
      />
    </Section>
  );
}

const REASONS = [
  {
    icon: <GraduationCap />,
    title: siteConfig.foundedBy,
    description:
      'ASRA Academy was started by students of AMU to make quality learning accessible online.',
  },
  {
    icon: <Layers />,
    title: 'School and special courses in one place',
    description:
      'Classes 6–12 alongside English, Arabic, Urdu, Quranic Studies and Entrepreneurship & Business.',
  },
  {
    icon: <BookOpenText />,
    title: 'Structured, chapter-wise learning',
    description:
      'School subjects are organised chapter by chapter, with lectures, notes, practice questions and examinations.',
  },
  {
    icon: <MonitorSmartphone />,
    title: 'Learn from anywhere in India',
    description:
      'Built for students across the country, on the phone, tablet or computer they already use.',
  },
];

export function WhyAsra() {
  return (
    <Section
      id="why-asra"
      eyebrow="Why ASRA"
      title="An academy built around the learner"
      description="ASRA Academy combines school education, language development, entrepreneurship and Quranic Studies in one place."
    >
      <ul className="grid gap-5 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <li key={reason.title}>
            <FeatureCard icon={reason.icon} title={reason.title} description={reason.description} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function LiveClassesSection() {
  const sessions = upcomingPublicLiveClasses;
  return (
    <Section id="live-classes" tone="muted" aria-labelledby="live-classes-title">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="grid gap-4">
          <p className="type-eyebrow text-asra-gold-800">Live classes</p>
          <h2 id="live-classes-title" className="type-h2 text-heading">
            Learn live with ASRA faculty
          </h2>
          <p className="type-body-lg text-muted-foreground">
            Live online classes are a core part of learning at ASRA Academy, alongside recorded
            lectures and study materials.
          </p>
          {sessions.length === 0 ? (
            <p className="type-body text-muted-foreground">
              Class timetables have not been published yet. Contact us to ask about upcoming batches
              for the class or course you are interested in.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/contact?topic=admission">Ask about batches</Link>
            </Button>
          </div>
        </div>

        {sessions.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sessions.map((session) => (
              <li key={`${session.title}-${String(session.startsAt)}`}>
                <LiveClassCard {...session} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
            <h3 className="mb-4 type-h4 text-heading">What to expect</h3>
            <CheckList
              items={[
                'Scheduled online sessions with ASRA faculty',
                'Join from a phone, tablet or computer',
                'Recorded lectures and notes for revision',
                'Practice and assessments to check your understanding',
              ]}
            />
          </div>
        )}
      </div>
    </Section>
  );
}

export function FacultySection() {
  const faculty = publicFaculty.slice(0, 4);
  return (
    <Section
      id="faculty"
      eyebrow="Faculty"
      title="Meet our teachers"
      action={
        faculty.length > 0 ? (
          <Button asChild variant="outline">
            <Link href="/faculty">View all faculty</Link>
          </Button>
        ) : undefined
      }
    >
      {faculty.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {faculty.map((member) => (
            <li key={member.name}>
              <FacultyCard {...member} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Users />}
          headingLevel="h3"
          title="Faculty profiles are on their way"
          description="We will introduce ASRA Academy's teachers here as their profiles are published."
          action={
            <Button asChild variant="outline">
              <Link href="/faculty">Visit the faculty page</Link>
            </Button>
          }
        />
      )}
    </Section>
  );
}

export function LearningProcess() {
  return (
    <Section
      id="learning-process"
      tone="muted"
      eyebrow="How it works"
      title="Getting started is simple"
      action={
        <Button asChild variant="outline">
          <Link href="/admission">Admission details</Link>
        </Button>
      }
    >
      <LearningSteps />
    </Section>
  );
}

export function TestimonialsSection() {
  const testimonials = approvedTestimonials;
  return (
    <Section id="testimonials" eyebrow="Testimonials" title="Student voices">
      {testimonials.length > 0 ? (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <li key={`${testimonial.authorName}-${testimonial.quote.slice(0, 24)}`}>
              <TestimonialCard {...testimonial} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto grid max-w-3xl justify-items-center gap-4 rounded-2xl border bg-card px-6 py-10 text-center shadow-card">
          <Quote className="size-8 text-asra-gold-600" aria-hidden />
          <h3 className="type-h3 text-heading">Stories from our learners</h3>
          <p className="max-w-xl type-body text-muted-foreground">
            Testimonials from ASRA Academy students and their families will be shared here once they
            have given their permission.
          </p>
        </div>
      )}
    </Section>
  );
}
