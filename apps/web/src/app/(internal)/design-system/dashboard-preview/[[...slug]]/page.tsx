import { notFound } from 'next/navigation';

import { AssignmentCard } from '@/components/asra/assignments/assignment-card';
import { CourseCard } from '@/components/asra/courses/course-card';
import { ExamCard } from '@/components/asra/exams/exam-card';
import { LiveClassCard } from '@/components/asra/live-classes/live-class-card';
import { ProgressCard } from '@/components/asra/progress/progress-card';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';

import {
  demoAssignments,
  demoCourses,
  demoExams,
  demoLiveClasses,
  demoProgress,
} from '../../_fixtures';

const PAGES = {
  '': 'Overview',
  courses: 'My courses',
  live: 'Live classes',
  assignments: 'Assignments',
  exams: 'Exams',
  recorded: 'Recorded lectures',
} as const;

type PageKey = keyof typeof PAGES;

const grid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

export default async function DashboardPreviewPage({
  params,
}: PageProps<'/design-system/dashboard-preview/[[...slug]]'>) {
  const { slug } = await params;
  const key = (slug?.join('/') ?? '') as PageKey;
  if (!Object.hasOwn(PAGES, key)) notFound();
  const title = PAGES[key];

  return (
    <>
      <PageHeader
        title={title}
        description="Layout preview with demo data — not a real student dashboard."
        breadcrumbs={[
          { label: 'Design system', href: '/design-system' },
          ...(key
            ? [{ label: 'Dashboard preview', href: '/design-system/dashboard-preview' }]
            : []),
          { label: title },
        ]}
      />
      {key === '' ? (
        <>
          <section aria-label="Progress" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {demoProgress.map((item) => (
              <ProgressCard key={item.title} {...item} headingLevel="h2" />
            ))}
          </section>
          <section aria-label="Upcoming" className={grid}>
            {demoLiveClasses.slice(0, 2).map((item) => (
              <LiveClassCard key={item.title} {...item} headingLevel="h2" />
            ))}
            <AssignmentCard {...demoAssignments[0]!} headingLevel="h2" />
          </section>
        </>
      ) : null}
      {key === 'courses' ? (
        <div className={grid}>
          {demoCourses.map((item) => (
            <CourseCard key={item.title} {...item} headingLevel="h2" />
          ))}
        </div>
      ) : null}
      {key === 'live' ? (
        <div className={grid}>
          {demoLiveClasses.map((item) => (
            <LiveClassCard key={item.title} {...item} headingLevel="h2" />
          ))}
        </div>
      ) : null}
      {key === 'assignments' ? (
        <div className={grid}>
          {demoAssignments.map((item) => (
            <AssignmentCard key={item.title} {...item} headingLevel="h2" />
          ))}
        </div>
      ) : null}
      {key === 'exams' ? (
        <div className={grid}>
          {demoExams.map((item) => (
            <ExamCard key={item.title} {...item} headingLevel="h2" />
          ))}
        </div>
      ) : null}
      {key === 'recorded' ? (
        <Alert tone="info" title="Placeholder page">
          <p>Recorded lectures arrive in Phase 07. This route only demonstrates navigation.</p>
        </Alert>
      ) : null}
    </>
  );
}
