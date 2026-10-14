'use client';

import { MoreHorizontal } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { demoTableRows } from '../_fixtures';

/** Table with populated / empty states and row actions. Toggle is local state only. */
export function TableDemo({ narrow = false }: { narrow?: boolean }) {
  const [empty, setEmpty] = React.useState(false);
  const rows = empty ? [] : demoTableRows;

  return (
    <div className="grid gap-3">
      {narrow ? null : (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmpty((value) => !value)}
            aria-pressed={empty}
          >
            {empty ? 'Show rows' : 'Show empty state'}
          </Button>
        </div>
      )}
      <Table
        scrollLabel="Demo students table"
        containerClassName={narrow ? 'max-w-xs' : undefined}
        className="min-w-[36rem]"
      >
        <TableCaption>Demo data — not real students.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty
              colSpan={4}
              title="No students yet"
              description="Students appear here once they enrol."
            />
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.course}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'Active' ? 'success' : 'warning'}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Callback-mode pagination: the parent owns the page number. */
export function PaginationDemo() {
  const [page, setPage] = React.useState(1);
  const pageCount = 12;
  return (
    <div className="grid gap-3">
      <p className="type-body-sm text-muted-foreground" aria-live="polite">
        Showing page <strong className="text-foreground">{page}</strong> of {pageCount} (demo — no
        data is fetched).
      </p>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        label="Demo pagination"
      />
    </div>
  );
}
