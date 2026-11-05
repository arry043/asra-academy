'use client';

import type { RecruitmentStatsDto } from '@asra/types';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Plus,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { KpiCard, Section } from '../admin-kit';
import { ErrorPanel, LoadingPanel } from '../admin-ui';
import { useAdminApi, useApiResource } from '../use-admin';

export function RecruitmentOverview() {
  const api = useAdminApi();
  const {
    data: stats,
    loading,
    error,
    reload,
  } = useApiResource<RecruitmentStatsDto>('/admin/recruitment/stats', () =>
    api.get<RecruitmentStatsDto>('/admin/recruitment/stats'),
  );

  if (loading) {
    return <LoadingPanel label="Loading recruitment overview…" />;
  }

  if (error || !stats) {
    return (
      <ErrorPanel
        title="Could not load recruitment overview"
        message={error?.message || 'Failed to load recruitment overview.'}
        onRetry={reload}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-h2 text-heading">Recruitment & Careers</h1>
          <p className="type-body text-muted-foreground">
            Manage institutional job openings, candidate applications, interview schedules and
            communication.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/careers" target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 size-4" /> View Careers Page
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/recruitment/applications">
              <Users className="mr-2 size-4" /> All Applications ({stats.totalApplications})
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/recruitment/jobs/new">
              <Plus className="mr-2 size-4" /> Post New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Total Positions"
          value={stats.totalJobs}
          hint={`${stats.publishedJobs} active`}
          icon={<Briefcase />}
          href="/admin/recruitment/jobs"
        />
        <KpiCard
          title="Applications"
          value={stats.totalApplications}
          hint={`${stats.receivedApplications} new received`}
          icon={<FileText />}
          href="/admin/recruitment/applications"
        />
        <KpiCard
          title="Under Review"
          value={stats.underReviewApplications}
          hint="screening in progress"
          icon={<Clock />}
          href="/admin/recruitment/applications?status=UNDER_REVIEW"
        />
        <KpiCard
          title="Shortlisted"
          value={stats.shortlistedApplications}
          hint="passed initial review"
          icon={<FileCheck />}
          href="/admin/recruitment/applications?status=SHORTLISTED"
        />
        <KpiCard
          title="Interviews"
          value={stats.interviewScheduledApplications}
          hint="Google Meet scheduled"
          icon={<Video />}
          href="/admin/recruitment/applications?status=INTERVIEW_SCHEDULED"
        />
        <KpiCard
          title="Selected"
          value={stats.acceptedApplications}
          hint={`${stats.rejectedApplications} rejected`}
          icon={<CheckCircle2 />}
          href="/admin/recruitment/applications?status=ACCEPTED"
        />
      </div>

      {/* Secondary Quick Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="type-caption text-muted-foreground">Draft Jobs</span>
            <Badge variant="outline">{stats.draftJobs}</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="type-caption text-muted-foreground">Expired Jobs</span>
            <Badge variant="secondary">{stats.expiredJobs}</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="type-caption text-muted-foreground">On Hold</span>
            <Badge variant="outline">{stats.onHoldApplications}</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="type-caption text-muted-foreground">Rejected</span>
            <Badge variant="destructive">{stats.rejectedApplications}</Badge>
          </div>
        </Card>
      </div>

      {/* Tables Row: Recent Applications & Recent Postings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Applications */}
        <Section
          title="Recent Applications"
          description="Latest candidate submissions"
          href="/admin/recruitment/applications"
          hrefLabel="View all applications"
        >
          {stats.recentApplications.length === 0 ? (
            <p className="type-body text-muted-foreground">No applications received yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="font-medium text-heading">{app.fullName}</div>
                      <div className="type-caption text-muted-foreground">{app.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="line-clamp-1 text-heading">{app.jobTitle}</div>
                      <div className="type-caption text-muted-foreground">{app.jobPublicId}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/recruitment/applications/${app.id}`}>Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        {/* Recent Job Postings */}
        <Section
          title="Recent Job Postings"
          description="Active and draft vacancies"
          href="/admin/recruitment/jobs"
          hrefLabel="Manage all jobs"
        >
          {stats.recentJobs.length === 0 ? (
            <p className="type-body text-muted-foreground">No job postings created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Apps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/admin/recruitment/jobs/${job.id}/edit`}
                        className="line-clamp-1 font-medium text-primary hover:underline"
                      >
                        {job.title}
                      </Link>
                      <div className="type-caption text-muted-foreground">{job.jobId}</div>
                    </TableCell>
                    <TableCell>
                      <span className="type-caption text-heading">{job.department}</span>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} isExpired={job.isExpired} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {job.applicationsCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      {/* Breakdowns Row */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Section
          title="Applications by Department"
          description="Candidate interest across academy departments"
        >
          {stats.applicationsByDepartment.length === 0 ? (
            <p className="type-caption text-muted-foreground">No data available.</p>
          ) : (
            <div className="grid gap-2">
              {stats.applicationsByDepartment.map((item) => (
                <div
                  key={item.department}
                  className="flex items-center justify-between rounded-lg border bg-background/50 p-3"
                >
                  <span className="font-medium text-heading">{item.department}</span>
                  <Badge variant="secondary">{item.count} applications</Badge>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Applications by Category"
          description="Candidate interest across functional categories"
        >
          {stats.applicationsByCategory.length === 0 ? (
            <p className="type-caption text-muted-foreground">No data available.</p>
          ) : (
            <div className="grid gap-2">
              {stats.applicationsByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-lg border bg-background/50 p-3"
                >
                  <span className="font-medium text-heading">{item.category}</span>
                  <Badge variant="secondary">{item.count} applications</Badge>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'RECEIVED':
      return <Badge variant="outline">Received</Badge>;
    case 'UNDER_REVIEW':
      return <Badge className="bg-blue-600 text-white hover:bg-blue-600">Under Review</Badge>;
    case 'SHORTLISTED':
      return <Badge className="bg-amber-600 text-white hover:bg-amber-600">Shortlisted</Badge>;
    case 'ON_HOLD':
      return <Badge variant="secondary">On Hold</Badge>;
    case 'INTERVIEW_SCHEDULED':
      return <Badge className="bg-purple-600 text-white hover:bg-purple-600">Interview</Badge>;
    case 'ACCEPTED':
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Accepted</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function JobStatusBadge({ status, isExpired }: { status: string; isExpired?: boolean }) {
  if (isExpired) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  switch (status) {
    case 'PUBLISHED':
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Published</Badge>;
    case 'DRAFT':
      return <Badge variant="outline">Draft</Badge>;
    case 'ARCHIVED':
      return <Badge variant="secondary">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
