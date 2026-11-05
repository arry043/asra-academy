'use client';

import type { AdminJobApplicationListItemDto, AdminJobListItemDto } from '@asra/types';
import { RefreshCw, Search, Video } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListFrame, usePagedList } from '../admin-kit';
import { useAdminApi, useApiResource } from '../use-admin';
import { StatusBadge } from './recruitment-overview';

export function ApplicationList() {
  const searchParams = useSearchParams();
  const api = useAdminApi();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>(searchParams.get('status') ?? '');
  const [jobId, setJobId] = React.useState<string>(searchParams.get('jobId') ?? '');

  // Load jobs list for dropdown filter
  const { data: jobsList } = useApiResource<{ items: AdminJobListItemDto[] }>(
    '/admin/recruitment/jobs?pageSize=100',
    () => api.get<{ items: AdminJobListItemDto[] }>('/admin/recruitment/jobs?pageSize=100'),
  );

  const { list, setPage } = usePagedList<AdminJobApplicationListItemDto>(
    '/admin/recruitment/applications',
    {
      search: search.trim() || undefined,
      status: status || undefined,
      jobId: jobId || undefined,
    },
    20,
  );

  return (
    <div className="grid gap-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-h2 text-heading">Candidate Applications</h1>
          <p className="type-body text-muted-foreground">
            Review applicant qualifications, screening questions, resumes, and schedule candidate
            interviews.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search candidate name, email, phone or Reference ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
          <option value="ACCEPTED">Accepted / Selected</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* Job Filter */}
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="h-9 max-w-[200px] truncate rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-ring"
        >
          <option value="">All Positions</option>
          {(jobsList?.items ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} ({j.jobId})
            </option>
          ))}
        </select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            setStatus('');
            setJobId('');
            list.reload();
          }}
          title="Reset filters"
        >
          Reset
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => list.reload()}
          aria-label="Refresh application list"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      {/* Applications Table */}
      <ListFrame
        list={list}
        setPage={setPage}
        label="applications"
        emptyTitle="No applications found"
        emptyText="No candidate applications match your current search and filter criteria."
      >
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate & Contact</TableHead>
                <TableHead>Position & ID</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interviews</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="font-medium text-heading">
                      <Link
                        href={`/admin/recruitment/applications/${app.id}`}
                        className="text-primary hover:underline"
                      >
                        {app.fullName}
                      </Link>
                    </div>
                    <div className="type-caption text-muted-foreground">{app.email}</div>
                    <div className="font-mono type-caption text-muted-foreground">{app.phone}</div>
                  </TableCell>

                  <TableCell>
                    <div className="line-clamp-1 font-medium text-heading">{app.jobTitle}</div>
                    <div className="font-mono type-caption text-muted-foreground">
                      {app.jobPublicId} · {app.referenceId}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="type-caption">{app.currentLocation}</span>
                  </TableCell>

                  <TableCell>
                    <span className="type-caption">
                      {new Date(app.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={app.status} />
                  </TableCell>

                  <TableCell>
                    {app.interviewsCount > 0 ? (
                      <Badge variant="outline" className="flex w-fit items-center gap-1">
                        <Video className="size-3 text-purple-600" />
                        {app.interviewsCount}
                      </Badge>
                    ) : (
                      <span className="type-caption text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/recruitment/applications/${app.id}`}>
                        Review Application
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>
    </div>
  );
}
