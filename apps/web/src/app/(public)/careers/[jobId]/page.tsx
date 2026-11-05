import type { PublicJobDetailDto } from '@asra/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JobDetailView } from '@/components/public/careers/job-detail-view';
import { PageHero } from '@/components/public/page-hero';
import { apiRequest } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

interface JobDetailPageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const { jobId } = await params;
  try {
    const job = await apiRequest<PublicJobDetailDto>(`/careers/${jobId}`);
    return buildPageMetadata({
      title: `${job.title} — Careers`,
      description:
        job.shortDescription ||
        `Apply for the ${job.title} position in ${job.department} at ASRA Academy.`,
      path: `/careers/${jobId}`,
    });
  } catch {
    return buildPageMetadata({
      title: 'Job Opening — Careers',
      description: 'Explore career opportunities at ASRA Academy.',
      path: `/careers/${jobId}`,
    });
  }
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
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
        path={`/careers/${job.jobId}`}
        breadcrumbs={[{ label: 'Careers', href: '/careers' }, { label: job.title }]}
        eyebrow={`${job.department} • ${job.category}`}
        title={job.title}
        description={job.shortDescription || `Position ID: ${job.jobId}`}
      />
      <JobDetailView job={job} />
    </>
  );
}
