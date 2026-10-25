'use client';

import type { AdminCertificateListItem } from '@asra/types';
import { Award, Download, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';

import { FilterSelect, ListFrame, SearchBox, usePagedList } from './admin-kit';
import { errorMessage, useAdminApi } from './use-admin';

const overview = { label: 'Overview', href: '/admin' };

export function CertificatesAdmin() {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const api = useAdminApi();
  const { list, setPage } = usePagedList<AdminCertificateListItem>('/admin/certificates', {
    search,
    status,
  });

  const handleDownload = async (cert: AdminCertificateListItem) => {
    try {
      setDownloadingId(cert.id);
      const blob = await api.download(`/api/v1/admin/certificates/${cert.id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ASRA-Certificate-${cert.certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${errorMessage(err)}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt('Enter the official reason for revoking this certificate:');
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) {
        alert('A valid reason of at least 3 characters is required to revoke a certificate.');
      }
      return;
    }

    try {
      await api.post(`/admin/certificates/${id}/revoke`, { reason: reason.trim() });
      list.reload();
    } catch (err) {
      alert(`Revocation failed: ${errorMessage(err)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Search, inspect, download, and manage completion certificates across all academy courses."
        breadcrumbs={[overview, { label: 'Certificates' }]}
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SearchBox
          id="cert-search"
          placeholder="Certificate ID, student name, email, or course..."
          onSearch={setSearch}
        />
        <FilterSelect
          id="cert-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'ISSUED', label: 'Issued' },
            { value: 'REVOKED', label: 'Revoked' },
          ]}
        />
      </div>

      <ListFrame list={list} setPage={setPage} label="certificates" icon={<Award />}>
        {(items: AdminCertificateListItem[]) => (
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isIssued = item.status === 'ISSUED';
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-800">
                        {item.certificateNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{item.recipientName}</div>
                        <div className="text-xs text-muted-foreground">{item.studentEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="line-clamp-1 font-medium text-slate-900">
                          {item.courseTitle}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Issuer: {item.issuedByName ?? 'LMS System'}
                        </div>
                      </TableCell>
                      <TableCell className="space-y-0.5 text-xs">
                        <div>Completed: {formatDate(item.completedAt)}</div>
                        <div className="text-muted-foreground">
                          Issued: {formatDate(item.issuedAt)}
                        </div>
                        {item.revokedAt && (
                          <div className="font-medium text-red-600">
                            Revoked: {formatDate(item.revokedAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isIssued ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-800"
                          >
                            Issued
                          </Badge>
                        ) : (
                          <Badge variant="destructive" title={item.revokedReason ?? undefined}>
                            Revoked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={downloadingId === item.id}
                            onClick={() => void handleDownload(item)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            title="Public Verification Link"
                          >
                            <Link href={`/verify/${item.certificateNumber}`} target="_blank">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          {isIssued && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => void handleRevoke(item.id)}
                              title="Revoke Certificate"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ListFrame>
    </>
  );
}
