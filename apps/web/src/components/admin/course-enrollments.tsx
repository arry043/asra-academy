'use client';

import {
  PERMISSIONS,
  type AdminCourseDetail,
  type AdminEnrollmentDto,
  type Paginated,
} from '@asra/types';
import { adminEnrollmentCreateSchema } from '@asra/validation';
import { UserPlus, Users } from 'lucide-react';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { FormField } from '@/components/auth/form-controls';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDate } from '@/lib/format';

import { ConfirmDialog, ErrorPanel, LoadingPanel } from './admin-ui';
import { errorMessage, hasPermission, useAdminApi, useApiResource } from './use-admin';

/**
 * Manual enrolment (PHASE 07, `enrollments.manage`): e.g. offline payment or scholarship (M-07).
 * Online purchases (PHASE 10) create their own PAYMENT enrolments. It records who enrolled the
 * student; it never records or implies a payment.
 */
export function EnrollmentsPanel({ course }: { course: AdminCourseDetail }) {
  const { user } = useAuth();
  const api = useAdminApi();
  const [page, setPage] = React.useState(1);
  const path = `/admin/courses/${course.id}/enrollments?page=${page}&pageSize=20`;
  const list = useApiResource(path, () => api.get<Paginated<AdminEnrollmentDto>>(path));
  const [cancelling, setCancelling] = React.useState<AdminEnrollmentDto | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  if (!hasPermission(user, PERMISSIONS.ENROLLMENTS_MANAGE)) {
    return (
      <Alert tone="info" title="No access">
        <p>You do not have permission to manage enrolments.</p>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      <EnrolForm course={course} onEnrolled={list.reload} />
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading enrolments…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No students enrolled"
          description={
            course.priceMinor === 0
              ? 'This course is free: students can also enrol themselves from their portal once it is published.'
              : 'Enrol students by email above.'
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="grid">
                        <span className="font-medium">{row.student.fullName}</span>
                        <span className="type-caption text-muted-foreground">
                          {row.student.email}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {row.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.progress.percent === null
                        ? '—'
                        : `${row.progress.percent}% (${row.progress.completedLessons}/${row.progress.totalLessons})`}
                    </TableCell>
                    <TableCell>
                      <span className="grid">
                        <span>{formatDate(row.enrolledAt)}</span>
                        <span className="type-caption text-muted-foreground">
                          {row.source === 'FREE'
                            ? 'Self-enrolled (free)'
                            : row.source === 'PAYMENT'
                              ? 'Paid online'
                              : `By ${row.enrolledBy ?? 'an administrator'}`}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === 'ACTIVE' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancelError(null);
                            setCancelling(row);
                          }}
                        >
                          Cancel enrolment
                        </Button>
                      ) : (
                        <span className="type-caption text-muted-foreground">
                          {formatDate(row.cancelledAt)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Enrolment pages"
            />
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this enrolment?"
        description={`${cancelling?.student.fullName ?? 'The student'} will lose access to this course immediately. Their progress is kept, and you can enrol them again later.`}
        confirmLabel="Cancel enrolment"
        pendingLabel="Cancelling…"
        destructive
        onConfirm={async () => {
          try {
            await api.post(`/admin/enrollments/${cancelling!.id}/cancel`);
            toast.success('Enrolment cancelled');
            list.reload();
          } catch (error) {
            setCancelError(errorMessage(error));
            throw error;
          }
        }}
      >
        {cancelError ? (
          <p role="alert" className="type-body-sm text-destructive">
            {cancelError}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function EnrolForm({ course, onEnrolled }: { course: AdminCourseDetail; onEnrolled: () => void }) {
  const api = useAdminApi();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [alert, setAlert] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const archived = course.status === 'ARCHIVED';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = validateForm(adminEnrollmentCreateSchema, {
      email: new FormData(formElement).get('enrol-email'),
    });
    setAlert(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const created = await api.post<AdminEnrollmentDto>(
        `/admin/courses/${course.id}/enrollments`,
        parsed.data,
      );
      toast.success('Student enrolled', { description: created.student.fullName });
      formElement.reset();
      onEnrolled();
    } catch (error) {
      const { message, fieldErrors } = describeError(error);
      setErrors(fieldErrors);
      if (!fieldErrors.email) setAlert(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
      aria-labelledby="enrol-heading"
    >
      <div className="grid gap-1">
        <h2 id="enrol-heading" className="type-h3 text-heading">
          Enrol a student
        </h2>
        <p className="type-body-sm text-muted-foreground">
          Use the email of an existing student account. This does not record a payment.
          {course.status !== 'PUBLISHED' && !archived
            ? ' Lessons open for the student once the course is published.'
            : ''}
        </p>
      </div>
      {archived ? (
        <Alert tone="warning">
          <p>Archived courses cannot take new enrolments.</p>
        </Alert>
      ) : null}
      {alert ? (
        <Alert tone="error">
          <p>{alert}</p>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <FormField
          id="enrol-email"
          label="Student email"
          type="email"
          autoComplete="off"
          required
          disabled={archived}
          error={errors.email}
          className="sm:w-80"
        />
        <Button
          type="submit"
          loading={pending}
          loadingText="Enrolling…"
          disabled={archived}
          className="sm:mt-7"
        >
          <UserPlus aria-hidden /> Enrol
        </Button>
      </div>
    </form>
  );
}
