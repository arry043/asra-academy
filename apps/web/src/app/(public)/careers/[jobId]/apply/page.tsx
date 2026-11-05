import type { PublicJobDetailDto } from '@asra/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JobApplyForm } from '@/components/public/careers/job-apply-form';
import { PageHero } from '@/components/public/page-hero';
import { apiRequest } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

interface JobApplyPageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: JobApplyPageProps): Promise<Metadata> {
  const { jobId } = await params;
  try {
    const job = await apiRequest<PublicJobDetailDto>(`/careers/${jobId}`);
    return buildPageMetadata({
      title: `Apply for ${job.title} — Careers`,
      description: `Submit your application for the ${job.title} position at ASRA Academy.`,
      path: `/careers/${jobId}/apply`,
    });
  } catch {
    return buildPageMetadata({
      title: 'Apply for Position — Careers',
      description: 'Submit your job application at ASRA Academy.',
      path: `/careers/${jobId}/apply`,
    });
  }
}

export default async function JobApplyPage({ params }: JobApplyPageProps) {
  const { jobId } = await params;

  let job: PublicJobDetailDto;
  try {
    job = await apiRequest<PublicJobDetailDto>(`/careers/${jobId}`);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHero
        path={`/careers/${job.jobId}/apply`}
        breadcrumbs={[
          { label: 'Careers', href: '/careers' },
          { label: job.title, href: `/careers/${job.jobId}` },
          { label: 'Apply' },
        ]}
        eyebrow="Job Application"
        title={`Apply: ${job.title}`}
        description={`Position ID: ${job.jobId} • Department: ${job.department}`}
      />
      <JobApplyForm job={job} />
    </>
  );
}
