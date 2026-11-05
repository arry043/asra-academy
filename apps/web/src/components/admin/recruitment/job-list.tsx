'use client';

import type { AdminJobListItemDto } from '@asra/types';
import {
  Archive,
  Check,
  Edit,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ListFrame, usePagedList } from '../admin-kit';
import { errorMessage, useAdminApi } from '../use-admin';
import { JobStatusBadge } from './recruitment-overview';

export function JobList() {
  const api = useAdminApi();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [department, setDepartment] = React.useState<string>('');

  const [actionJob, setActionJob] = React.useState<{
    job: AdminJobListItemDto;
    type: 'publish' | 'unpublish' | 'archive' | 'delete';
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { list, setPage } = usePagedList<AdminJobListItemDto>(
    '/admin/recruitment/jobs',
    {
      search: search.trim() || undefined,
      status: status || undefined,
      department: department.trim() || undefined,
    },
    15,
  );

  const handleAction = async () => {
    if (!actionJob) return;
    setIsSubmitting(true);
    try {
      const { job, type } = actionJob;
      if (type === 'publish') {
        await api.post(`/admin/recruitment/jobs/${job.id}/publish`);
        toast.success('Job Published', {
          description: `"${job.title}" is now visible to applicants.`,
        });
      } else if (type === 'unpublish') {
        await api.post(`/admin/recruitment/jobs/${job.id}/unpublish`);
        toast.success('Job Unpublished', {
          description: `"${job.title}" has been reverted to draft.`,
        });
      } else if (type === 'archive') {
        await api.post(`/admin/recruitment/jobs/${job.id}/archive`);
        toast.success('Job Archived', { description: `"${job.title}" has been archived.` });
      } else if (type === 'delete') {
        await api.del(`/admin/recruitment/jobs/${job.id}`);
        toast.success('Job Deleted', { description: `"${job.title}" has been deleted.` });
      }
      setActionJob(null);
      list.reload();
    } catch (err) {
      toast.error('Action Failed', {
        description: errorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Top Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-h2 text-heading">Job Openings</h1>
          <p className="type-body text-muted-foreground">
            Create and manage job postings for teaching and administrative vacancies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/admin/recruitment/jobs/new">
              <Plus className="mr-2 size-4" /> Post New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, Job ID or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Department…"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-9 w-40"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => list.reload()}
          aria-label="Refresh job list"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      {/* Jobs Table */}
      <ListFrame
        list={list}
        setPage={setPage}
        label="jobs"
        emptyTitle="No jobs found"
        emptyText="No job postings match your filters. Create a new vacancy to get started."
      >
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Title & ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="font-medium text-heading">
                      <Link
                        href={`/admin/recruitment/jobs/${job.id}/edit`}
                        className="text-primary hover:underline"
                      >
                        {job.title}
                      </Link>
                    </div>
                    <div className="font-mono type-caption text-muted-foreground">{job.jobId}</div>
                  </TableCell>
                  <TableCell>
                    <div>{job.department}</div>
                    <div className="type-caption text-muted-foreground">{job.category}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.employmentType}</Badge>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} isExpired={job.isExpired} />
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/recruitment/applications?jobId=${job.id}`}>
                        {job.applicationsCount} application{job.applicationsCount === 1 ? '' : 's'}
                      </Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {job.closingDate ? (
                      <span className="type-caption">
                        {new Date(job.closingDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="type-caption text-muted-foreground">Rolling</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {job.status === 'PUBLISHED' && !job.isExpired ? (
                        <Button asChild variant="ghost" size="icon" title="View Public Page">
                          <Link
                            href={`/careers/${job.jobId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="ghost" size="icon" title="Edit Job">
                        <Link href={`/admin/recruitment/jobs/${job.id}/edit`}>
                          <Edit className="size-4" />
                        </Link>
                      </Button>
                      {job.status === 'DRAFT' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Publish Job"
                          onClick={() => setActionJob({ job, type: 'publish' })}
                        >
                          <Check className="size-4 text-emerald-600" />
                        </Button>
                      ) : job.status === 'PUBLISHED' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Unpublish Job (Draft)"
                          onClick={() => setActionJob({ job, type: 'unpublish' })}
                        >
                          <X className="size-4 text-amber-600" />
                        </Button>
                      ) : null}
                      {job.status !== 'ARCHIVED' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Archive Job"
                          onClick={() => setActionJob({ job, type: 'archive' })}
                        >
                          <Archive className="size-4 text-muted-foreground" />
                        </Button>
                      ) : null}
                      {job.applicationsCount === 0 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Job"
                          onClick={() => setActionJob({ job, type: 'delete' })}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>

      {/* Confirmation Dialog */}
      <Dialog open={actionJob !== null} onOpenChange={(open) => !open && setActionJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionJob?.type === 'publish' && 'Publish Job Posting'}
              {actionJob?.type === 'unpublish' && 'Unpublish Job Posting'}
              {actionJob?.type === 'archive' && 'Archive Job Posting'}
              {actionJob?.type === 'delete' && 'Delete Job Posting'}
            </DialogTitle>
            <DialogDescription>
              {actionJob?.type === 'publish' &&
                `Are you sure you want to publish "${actionJob?.job.title}"? It will become visible on the public careers portal immediately.`}
              {actionJob?.type === 'unpublish' &&
                `Are you sure you want to revert "${actionJob?.job.title}" to draft? It will no longer be visible to public applicants.`}
              {actionJob?.type === 'archive' &&
                `Are you sure you want to archive "${actionJob?.job.title}"? New applications will be disabled.`}
              {actionJob?.type === 'delete' &&
                `Are you sure you want to permanently delete "${actionJob?.job.title}"? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionJob(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={actionJob?.type === 'delete' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
