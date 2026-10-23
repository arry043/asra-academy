'use client';

import type {
  AdminUserDetail,
  AdminUserListItem,
  DirectoryRole,
  Paginated,
  UserStatus,
} from '@asra/types';
import { GraduationCap, ShieldCheck, UserRoundCheck, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { formatCount, roleLabel, USER_STATUS } from '@/lib/admin/analytics';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatAmount, ORDER_STATUS } from '@/lib/payments';

import { FilterSelect, ListFrame, SearchBox, Section, usePagedList } from './admin-kit';
import { ConfirmDialog, ErrorPanel, LoadingPanel, SelectField, StatusBadge } from './admin-ui';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

/**
 * Users (PHASE 12, docs/ADMIN-DASHBOARD.md §6.2): one directory per account type, each with its
 * own permission (students/faculty/admins.manage), and one detail page. The API decides which
 * accounts and actions are available; the UI only shows what the API reported as allowed.
 */

const DIRECTORY: Record<
  DirectoryRole,
  { title: string; description: string; icon: React.ReactNode; label: string }
> = {
  STUDENT: {
    title: 'Students',
    description: 'Student accounts, their class and enrolments.',
    icon: <GraduationCap />,
    label: 'students',
  },
  FACULTY: {
    title: 'Faculty',
    description: 'Faculty accounts and their course assignments.',
    icon: <UserRoundCheck />,
    label: 'faculty members',
  },
  ADMIN: {
    title: 'Administrators',
    description: 'Admin and Super Admin accounts.',
    icon: <ShieldCheck />,
    label: 'administrators',
  },
};

const STATUS_OPTIONS = (Object.keys(USER_STATUS) as UserStatus[]).map((status) => ({
  value: status,
  label: USER_STATUS[status].label,
}));

export function UserDirectory({ role }: { role: DirectoryRole }) {
  const api = useAdminApi();
  const meta = DIRECTORY[role];
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [enrollment, setEnrollment] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [sort, setSort] = React.useState('newest');
  const classes = useApiResource(role === 'STUDENT' ? '/admin/classes?pageSize=100' : null, () =>
    api.get<Paginated<{ id: string; name: string }>>('/admin/classes?pageSize=100'),
  );
  const { list, setPage } = usePagedList<AdminUserListItem>('/admin/users', {
    role,
    q,
    status,
    sort,
    ...(role === 'STUDENT' ? { enrollment, classId } : {}),
  });

  return (
    <>
      <PageHeader
        title={meta.title}
        description={meta.description}
        breadcrumbs={[{ label: 'Overview', href: '/admin' }, { label: meta.title }]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <SearchBox id={`${role}-q`} placeholder="Name, email or phone" onSearch={setQ} />
        <FilterSelect
          id={`${role}-status`}
          label="Account status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        {role === 'STUDENT' ? (
          <>
            <FilterSelect
              id="student-enrolment"
              label="Enrolment"
              value={enrollment}
              onChange={setEnrollment}
              options={[
                { value: 'active', label: 'Has an active enrolment' },
                { value: 'none', label: 'No active enrolment' },
              ]}
            />
            <FilterSelect
              id="student-class"
              label="Class"
              value={classId}
              onChange={setClassId}
              options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </>
        ) : null}
        <div className="w-40">
          <SelectField
            id={`${role}-sort`}
            label="Sort"
            value={sort}
            onValueChange={setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name', label: 'Name A–Z' },
            ]}
          />
        </div>
      </div>
      <ListFrame list={list} setPage={setPage} label={meta.label} icon={<Users />}>
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {role === 'STUDENT' ? <TableHead>Class</TableHead> : null}
                {role === 'STUDENT' ? (
                  <TableHead className="text-right">Enrolments</TableHead>
                ) : null}
                {role === 'FACULTY' ? <TableHead>Designation</TableHead> : null}
                {role === 'FACULTY' ? <TableHead className="text-right">Courses</TableHead> : null}
                {role === 'ADMIN' ? <TableHead>Roles</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/admin/users/${user.id}`} className="grid hover:text-primary">
                      <span className="font-medium">{user.fullName}</span>
                      <span className="type-caption text-muted-foreground">{user.email}</span>
                    </Link>
                  </TableCell>
                  {role === 'STUDENT' ? (
                    <TableCell>{user.student?.className ?? '—'}</TableCell>
                  ) : null}
                  {role === 'STUDENT' ? (
                    <TableCell className="text-right tabular-nums">
                      {user.student?.activeEnrollments ?? 0}
                      <span className="text-muted-foreground">
                        {' '}
                        / {user.student?.totalEnrollments ?? 0}
                      </span>
                    </TableCell>
                  ) : null}
                  {role === 'FACULTY' ? (
                    <TableCell>{user.faculty?.designation ?? '—'}</TableCell>
                  ) : null}
                  {role === 'FACULTY' ? (
                    <TableCell className="text-right tabular-nums">
                      {user.faculty?.assignedCourses ?? 0}
                    </TableCell>
                  ) : null}
                  {role === 'ADMIN' ? (
                    <TableCell>{user.roles.map(roleLabel).join(', ')}</TableCell>
                  ) : null}
                  <TableCell>
                    <Badge variant={USER_STATUS[user.status].tone}>
                      {USER_STATUS[user.status].label}
                    </Badge>
                    {!user.emailVerified ? (
                      <Badge variant="secondary" className="ml-1">
                        Email not verified
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="type-caption">{formatDate(user.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListFrame>
      {role === 'STUDENT' ? (
        <p className="type-caption text-muted-foreground">
          Enrolments: active / all (including cancelled).
        </p>
      ) : null}
    </>
  );
}

export function UserDetail({ id }: { id: string }) {
  const api = useAdminApi();
  const path = `/admin/users/${id}`;
  const detail = useApiResource(path, () => api.get<AdminUserDetail>(path));

  if (detail.error && !detail.data)
    return <ErrorPanel message={errorMessage(detail.error)} onRetry={detail.reload} />;
  if (!detail.data) return <LoadingPanel label="Loading account…" />;
  const user = detail.data;
  const directory = user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
    ? { label: 'Administrators', href: '/admin/admins' }
    : user.roles.includes('STUDENT')
      ? { label: 'Students', href: '/admin/students' }
      : { label: 'Faculty', href: '/admin/faculty' };

  return (
    <>
      <PageHeader
        title={user.fullName}
        description={user.email}
        breadcrumbs={[{ label: 'Overview', href: '/admin' }, directory, { label: user.fullName }]}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-4">
          <Section title="Account">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item term="Status">
                <Badge variant={USER_STATUS[user.status].tone}>
                  {USER_STATUS[user.status].label}
                </Badge>
              </Item>
              <Item term="Roles">{user.roles.map(roleLabel).join(', ') || '—'}</Item>
              <Item term="Email verified">{user.emailVerified ? 'Yes' : 'No'}</Item>
              <Item term="Phone">{user.phone ?? '—'}</Item>
              <Item term="Joined">{formatDateTime(user.createdAt)}</Item>
              <Item term="Last sign-in">
                {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Never'}
              </Item>
              {user.studentProfile ? (
                <>
                  <Item term="Student code">{user.studentProfile.studentCode ?? '—'}</Item>
                  <Item term="Class / stream">
                    {[user.studentProfile.class?.name, user.studentProfile.stream?.name]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Item>
                </>
              ) : null}
              {user.facultyProfile ? (
                <>
                  <Item term="Designation">{user.facultyProfile.designation ?? '—'}</Item>
                  <Item term="Specialization">{user.facultyProfile.specialization ?? '—'}</Item>
                  <Item term="Experience">
                    {user.facultyProfile.experienceYears === null
                      ? '—'
                      : `${user.facultyProfile.experienceYears} years`}
                  </Item>
                  <Item term="Public profile">
                    {user.facultyProfile.isPublic ? 'Shown on the website' : 'Hidden'}
                  </Item>
                </>
              ) : null}
            </dl>
          </Section>

          {user.enrollments ? (
            <Section
              title="Enrolments and progress"
              href="/admin/enrollments"
              hrefLabel="All enrolments"
            >
              {user.enrollments.length === 0 ? (
                <p className="type-body-sm text-muted-foreground">Not enrolled in any course.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-40">Progress</TableHead>
                        <TableHead>Enrolled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.enrollments.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <Link
                              href={`/admin/courses/${e.course.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {e.course.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={e.status === 'ACTIVE' ? 'success' : 'secondary'}>
                              {e.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                            </Badge>
                            {e.completedAt ? (
                              <Badge variant="info" className="ml-1">
                                Completed
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {e.progress.percent === null ? (
                              <span className="type-caption text-muted-foreground">
                                No counted lessons
                              </span>
                            ) : (
                              <span className="grid gap-1">
                                <Progress
                                  value={e.progress.percent}
                                  label={`${e.course.title} progress`}
                                />
                                <span className="type-caption text-muted-foreground">
                                  {e.progress.completedLessons}/{e.progress.totalLessons} lessons ·{' '}
                                  {e.progress.percent}%
                                </span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="type-caption">{formatDate(e.enrolledAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>
          ) : null}

          {user.orders ? (
            <Section title="Orders and payments" href="/admin/payments" hrefLabel="Payments">
              {user.orders.length === 0 ? (
                <p className="type-body-sm text-muted-foreground">No orders.</p>
              ) : (
                <ul className="grid divide-y">
                  {user.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                      <Link
                        href={`/admin/payments/orders/${o.id}`}
                        className="grid min-w-0 hover:text-primary"
                      >
                        <span className="truncate type-label">{o.course.title}</span>
                        <span className="type-caption text-muted-foreground">
                          {o.reference} · {o.mode === 'TEST' ? 'Test mode · ' : ''}
                          {formatDateTime(o.createdAt)}
                        </span>
                      </Link>
                      <span className="grid justify-items-end gap-1">
                        <span className="type-label tabular-nums">
                          {formatAmount(o.amountMinor, o.currency)}
                        </span>
                        <Badge variant={ORDER_STATUS[o.status].tone}>
                          {ORDER_STATUS[o.status].label}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          {user.teaching ? (
            <Section title="Teaching" description="Course assignments are managed on each course.">
              {user.teaching.length === 0 ? (
                <p className="type-body-sm text-muted-foreground">Not assigned to any course.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Active students</TableHead>
                        <TableHead className="text-right">Awaiting grade</TableHead>
                        <TableHead className="text-right">Upcoming classes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.teaching.map((t) => (
                        <TableRow key={t.course.id}>
                          <TableCell>
                            <span className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/admin/courses/${t.course.id}`}
                                className="hover:text-primary hover:underline"
                              >
                                {t.course.title}
                              </Link>
                              {t.isPrimary ? <Badge variant="accent">Primary</Badge> : null}
                              {t.course.status !== 'PUBLISHED' ? (
                                <StatusBadge status={t.course.status} />
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(t.activeStudents)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.pendingReviews}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.upcomingClasses}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <StatusCard user={user} onSaved={detail.replace} />
          <RolesCard user={user} onSaved={detail.replace} />
        </div>
      </div>
    </>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="type-caption text-muted-foreground">{term}</dt>
      <dd className="type-body-sm">{children}</dd>
    </div>
  );
}

function StatusCard({
  user,
  onSaved,
}: {
  user: AdminUserDetail;
  onSaved: (user: AdminUserDetail) => void;
}) {
  const api = useAdminApi();
  const [next, setNext] = React.useState<UserStatus>(
    user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
  );
  const [reason, setReason] = React.useState('');
  const [open, setOpen] = React.useState(false);
  if (!user.capabilities.changeStatus) {
    return (
      <Section title="Account status">
        <p className="type-body-sm text-muted-foreground">
          You cannot change this account’s status (your own account, or not within your
          permissions).
        </p>
      </Section>
    );
  }
  return (
    <Section
      title="Account status"
      description="Suspended and inactive accounts cannot sign in; open sessions stop working immediately."
    >
      <SelectField
        id="next-status"
        label="New status"
        value={next}
        onValueChange={(value) => setNext(value as UserStatus)}
        options={STATUS_OPTIONS.filter((option) => option.value !== user.status)}
      />
      <Field
        id="status-reason"
        label="Reason"
        optional
        hint="Kept in the audit log; not shown to the user."
      >
        <Textarea
          value={reason}
          maxLength={300}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant={next === 'ACTIVE' ? 'default' : 'destructive'}
        onClick={() => setOpen(true)}
      >
        Change to {USER_STATUS[next].label.toLowerCase()}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Change ${user.fullName} to ${USER_STATUS[next].label.toLowerCase()}?`}
        description={
          next === 'ACTIVE'
            ? 'The person will be able to sign in again.'
            : 'The person will be signed out everywhere and cannot sign in until an administrator reactivates the account. Nothing is deleted.'
        }
        confirmLabel="Change status"
        pendingLabel="Saving…"
        destructive={next !== 'ACTIVE'}
        onConfirm={async () => {
          try {
            const saved = await api.patch<AdminUserDetail>(`/admin/users/${user.id}/status`, {
              status: next,
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            });
            onSaved(saved);
            setReason('');
            setNext(saved.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
            toast.success('Account status updated');
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </Section>
  );
}

function RolesCard({
  user,
  onSaved,
}: {
  user: AdminUserDetail;
  onSaved: (user: AdminUserDetail) => void;
}) {
  const api = useAdminApi();
  const caps = user.capabilities;
  const [grant, setGrant] = React.useState('');
  const [pending, setPending] = React.useState<{ kind: 'grant' | 'revoke'; role: string } | null>(
    null,
  );
  if (!caps.manageRoles) return null;
  return (
    <Section
      title="Roles"
      description="You can only grant or remove roles whose permissions you hold yourself."
    >
      <ul className="flex flex-wrap gap-2">
        {user.roles.map((role) => (
          <li key={role}>
            <Badge variant="outline">
              {roleLabel(role)}
              {caps.revocableRoles.includes(role) ? (
                <button
                  type="button"
                  className="ml-1 rounded-sm px-1 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove role ${roleLabel(role)}`}
                  onClick={() => setPending({ kind: 'revoke', role })}
                >
                  ×
                </button>
              ) : null}
            </Badge>
          </li>
        ))}
      </ul>
      {caps.grantableRoles.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SelectField
              id="grant-role"
              label="Add role"
              value={grant}
              placeholder="Choose a role"
              onValueChange={setGrant}
              options={caps.grantableRoles.map((role) => ({ value: role, label: roleLabel(role) }))}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!grant}
            onClick={() => setPending({ kind: 'grant', role: grant })}
          >
            Add
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'grant'
            ? `Give ${user.fullName} the ${roleLabel(pending.role)} role?`
            : `Remove the ${roleLabel(pending?.role ?? '')} role from ${user.fullName}?`
        }
        description={
          pending?.kind === 'grant'
            ? 'The person gains every permission of this role at their next request. The change is recorded in the audit log.'
            : 'The person loses the permissions of this role at their next request. The change is recorded in the audit log.'
        }
        confirmLabel={pending?.kind === 'grant' ? 'Grant role' : 'Remove role'}
        pendingLabel="Saving…"
        destructive={pending?.kind === 'revoke'}
        onConfirm={async () => {
          if (!pending) return;
          try {
            const saved =
              pending.kind === 'grant'
                ? await api.post<AdminUserDetail>(`/admin/users/${user.id}/roles`, {
                    role: pending.role,
                  })
                : await api.del<AdminUserDetail>(`/admin/users/${user.id}/roles/${pending.role}`);
            onSaved(saved);
            setGrant('');
            toast.success(pending.kind === 'grant' ? 'Role granted' : 'Role removed');
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </Section>
  );
}
