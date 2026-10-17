'use client';

import type {
  CurriculumTreeDto,
  FacultyAssignmentDetail,
  FacultyAssignmentItem,
  Paginated,
  SubmissionDetailDto,
  SubmissionListItem,
} from '@asra/types';
import {
  assignmentCreateSchema,
  assignmentSettingsSchema,
  gradeSubmissionSchema,
  SUBMISSION_FILTERS,
} from '@asra/validation';
import { ExternalLink, Inbox, NotebookPen, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CheckboxField, ConfirmDialog, SelectField } from '@/components/admin/admin-ui';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
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
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
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
import { ApiClientError } from '@/lib/api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';
import {
  facultyCourseHref,
  formatMarks,
  istInputToIso,
  isoToIstInput,
  REVIEW_STATE_LABELS,
  reviewState,
} from '@/lib/faculty/portal';

import {
  CourseFilter,
  ErrorPanel,
  LateBadge,
  LoadingPanel,
  ReviewBadge,
  StatusBadge,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

const home = { label: 'Dashboard', href: '/faculty/dashboard' };
const assignmentsCrumb = { label: 'Assignments', href: '/faculty/assignments' };
const submissionsCrumb = { label: 'Submissions', href: '/faculty/submissions' };

// --- Assignments ----------------------------------------------------------------------------

/** ASSIGNMENT lessons of the faculty member's courses, with submission set-up and counts. */
export function AssignmentsTable({ courseId }: { courseId?: string }) {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const course = courseId ?? filter;
  const path = withQuery('/faculty/assignments', { page, pageSize: 20, courseId: course });
  const list = useApiResource(path, () => api.get<Paginated<FacultyAssignmentItem>>(path));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {courseId ? (
          <span />
        ) : (
          <div className="w-full max-w-sm">
            <CourseFilter
              id="assignments-course"
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
            />
          </div>
        )}
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New assignment
        </Button>
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading assignments…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<NotebookPen />}
          title="No assignments yet"
          description="Create an assignment in one of your course chapters. Students can submit once it is published."
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Assignments">
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Marks · due</TableHead>
                <TableHead>Submissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.lessonId}>
                  <TableCell>
                    <Link
                      href={`/faculty/assignments/${item.lessonId}`}
                      className="grid rounded-sm hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="font-medium text-heading hover:underline">{item.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {courseId ? '' : `${item.course.title} · `}
                        {item.module.title} › {item.chapter.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    {item.settings ? (
                      <span className="grid type-body-sm">
                        <span>Out of {item.settings.maxMarks}</span>
                        <span className="type-caption text-muted-foreground">
                          {item.settings.dueAt
                            ? `Due ${formatDateTime(item.settings.dueAt)} IST`
                            : 'No due date'}
                        </span>
                      </span>
                    ) : (
                      <Badge variant="warning">Online submission not set up</Badge>
                    )}
                  </TableCell>
                  <TableCell className="type-body-sm">
                    {item.counts.submitted} submitted · {item.counts.graded} graded ·{' '}
                    {item.counts.released} released
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Assignment pages"
            />
          ) : null}
        </div>
      )}
      {creating ? (
        <CreateAssignmentDialog
          courseId={courseId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            list.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateAssignmentDialog({
  courseId: fixedCourse,
  onClose,
  onCreated,
}: {
  courseId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const api = useFacultyApi();
  const [courseId, setCourseId] = React.useState(fixedCourse ?? '');
  const [chapterId, setChapterId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [maxMarks, setMaxMarks] = React.useState('');
  const [due, setDue] = React.useState('');
  const [status, setStatus] = React.useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [allowLate, setAllowLate] = React.useState(true);
  const [allowResubmission, setAllowResubmission] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const treePath = courseId ? `/faculty/courses/${courseId}/curriculum` : null;
  const tree = useApiResource(treePath, () => api.get<CurriculumTreeDto>(treePath!));
  const chapters =
    tree.data?.modules.flatMap((module) =>
      module.chapters.map((chapter) => ({
        value: chapter.id,
        label: `${module.title} › ${chapter.title}`,
      })),
    ) ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const dueAt = istInputToIso(due);
    const payload = {
      title,
      instructions,
      maxMarks: maxMarks.trim() === '' ? undefined : Number(maxMarks),
      dueAt: dueAt ?? null,
      status,
      allowLateSubmissions: allowLate,
      allowResubmission,
    };
    const parsed = validateForm(assignmentCreateSchema, payload);
    const local: FieldErrors = { ...(parsed.errors ?? {}) };
    if (!chapterId) local.chapterId = 'Choose the chapter this assignment belongs to';
    if (dueAt === undefined) local.dueAt = 'Enter a valid date and time';
    setFormError(null);
    if (Object.keys(local).length > 0 || !parsed.data) return setErrors(local);
    setErrors({});
    setPending(true);
    try {
      const created = await api.post<FacultyAssignmentDetail>(
        `/faculty/chapters/${chapterId}/assignments`,
        parsed.data,
      );
      toast.success('Assignment created', { description: created.title });
      onCreated();
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
          <DialogDescription>
            Creates an assignment lesson in the chosen chapter with online submission. Students can
            submit once it is published and the course is live.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {fixedCourse ? null : (
              <CourseFilter
                id="assignment-course"
                value={courseId}
                onChange={(value) => {
                  setCourseId(value);
                  setChapterId('');
                }}
                allLabel={null}
              />
            )}
            <SelectField
              id="assignment-chapter"
              label="Chapter"
              value={chapterId}
              onValueChange={setChapterId}
              options={chapters}
              error={errors.chapterId}
              disabled={!courseId || !tree.data}
              placeholder={
                !courseId
                  ? 'Choose a course first'
                  : tree.data && chapters.length === 0
                    ? 'Add a chapter in the curriculum first'
                    : 'Choose a chapter'
              }
            />
          </div>
          <Field id="assignment-title" label="Title" error={errors.title}>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field
            id="assignment-instructions"
            label="Instructions"
            error={errors.instructions}
            hint="Shown to students as plain text. Add worksheet links from the curriculum afterwards."
          >
            <Textarea
              value={instructions}
              rows={5}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="assignment-max" label="Maximum marks" error={errors.maxMarks}>
              <Input
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </Field>
            <Field
              id="assignment-due"
              label="Due (IST)"
              optional
              error={errors.dueAt}
              hint="Checked against server time."
            >
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <SelectField
              id="assignment-status"
              label="Status"
              value={status}
              onValueChange={(value) => setStatus(value as 'DRAFT' | 'PUBLISHED')}
              options={[
                { value: 'DRAFT', label: 'Draft (hidden)' },
                { value: 'PUBLISHED', label: 'Published (students can submit)' },
              ]}
            />
          </div>
          <SubmissionPolicyFields
            idPrefix="assignment"
            allowLate={allowLate}
            setAllowLate={setAllowLate}
            allowResubmission={allowResubmission}
            setAllowResubmission={setAllowResubmission}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Creating…">
              Create assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Late-submission and resubmission policy (I-02 pending; defaults keep the PHASE 08 rules). */
function SubmissionPolicyFields({
  idPrefix,
  allowLate,
  setAllowLate,
  allowResubmission,
  setAllowResubmission,
}: {
  idPrefix: string;
  allowLate: boolean;
  setAllowLate: (value: boolean) => void;
  allowResubmission: boolean;
  setAllowResubmission: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-3">
      <CheckboxField
        id={`${idPrefix}-late`}
        label="Accept late submissions"
        checked={allowLate}
        onChange={setAllowLate}
        hint="Late work is marked late. Off: submissions after the due date are refused."
      />
      <CheckboxField
        id={`${idPrefix}-resubmit`}
        label="Allow resubmission until graded"
        checked={allowResubmission}
        onChange={setAllowResubmission}
        hint="Earlier versions are kept and shown to you."
      />
    </div>
  );
}

export function AssignmentsPage() {
  return (
    <>
      <PageHeader
        title="Assignments"
        breadcrumbs={[home, { label: 'Assignments' }]}
        description="Assignment lessons of your courses. Each assignment sets whether late work is accepted and whether students may resubmit before grading. Marks are whole numbers."
      />
      <AssignmentsTable />
    </>
  );
}

/** One assignment: instructions summary, submission settings and its submissions. */
export function AssignmentDetail({ lessonId }: { lessonId: string }) {
  const api = useFacultyApi();
  const path = `/faculty/assignments/${lessonId}`;
  const detail = useApiResource(path, () => api.get<FacultyAssignmentDetail>(path));

  if (detail.error && !detail.data) {
    return (
      <>
        <PageHeader title="Assignment" breadcrumbs={[home, assignmentsCrumb, { label: 'Error' }]} />
        <ErrorPanel message={errorMessage(detail.error)} onRetry={detail.reload} />
      </>
    );
  }
  if (!detail.data) return <LoadingPanel label="Loading assignment…" rows={5} />;
  const data = detail.data;

  return (
    <>
      <PageHeader
        title={data.title}
        breadcrumbs={[home, assignmentsCrumb, { label: data.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span>
              {data.course.title} · {data.module.title} › {data.chapter.title}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={facultyCourseHref(data.course.id, 'curriculum')}>
              Edit instructions and attachments
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="instructions-heading" className="grid gap-2">
          <h2 id="instructions-heading" className="type-h3 text-heading">
            Instructions
          </h2>
          <div className="rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
            {data.instructions || (
              <span className="text-muted-foreground">No instructions written yet.</span>
            )}
          </div>
          <p className="type-caption text-muted-foreground">
            {data.resourceCount} attachment link{data.resourceCount === 1 ? '' : 's'} ·{' '}
            {data.activeStudents} enrolled student{data.activeStudents === 1 ? '' : 's'}
            {data.status === 'PUBLISHED' ? '' : ' · draft: students cannot see or submit it yet'}
          </p>
        </section>
        <SettingsForm assignment={data} onSaved={detail.replace} />
      </div>
      <section aria-labelledby="submissions-heading" className="grid gap-3">
        <h2 id="submissions-heading" className="type-h2 text-heading">
          Submissions
        </h2>
        <SubmissionsTable lessonId={lessonId} />
      </section>
    </>
  );
}

function SettingsForm({
  assignment,
  onSaved,
}: {
  assignment: FacultyAssignmentDetail;
  onSaved: (data: FacultyAssignmentDetail) => void;
}) {
  const api = useFacultyApi();
  const [maxMarks, setMaxMarks] = React.useState(String(assignment.settings?.maxMarks ?? ''));
  const [due, setDue] = React.useState(isoToIstInput(assignment.settings?.dueAt));
  const [allowLate, setAllowLate] = React.useState(
    assignment.settings?.allowLateSubmissions ?? true,
  );
  const [allowResubmission, setAllowResubmission] = React.useState(
    assignment.settings?.allowResubmission ?? false,
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const dueAt = istInputToIso(due);
    const parsed = validateForm(assignmentSettingsSchema, {
      maxMarks: maxMarks.trim() === '' ? undefined : Number(maxMarks),
      dueAt: dueAt ?? null,
      allowLateSubmissions: allowLate,
      allowResubmission,
    });
    setFormError(null);
    if (dueAt === undefined) return setErrors({ dueAt: 'Enter a valid date and time' });
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const saved = await api.put<FacultyAssignmentDetail>(
        `/faculty/lessons/${assignment.lessonId}/assignment`,
        parsed.data,
      );
      toast.success('Submission settings saved');
      onSaved(saved);
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="settings-heading"
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="settings-heading" className="type-h4 text-heading">
        Online submission
      </h2>
      {assignment.settings ? null : (
        <Alert tone="warning">
          <p>Students cannot submit online until you set the maximum marks.</p>
        </Alert>
      )}
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <Field
        id="settings-max"
        label="Maximum marks"
        error={errors.maxMarks}
        hint={assignment.counts.graded > 0 ? 'Fixed: submissions are already graded.' : undefined}
      >
        <Input
          type="number"
          min={1}
          max={1000}
          inputMode="numeric"
          value={maxMarks}
          onChange={(e) => setMaxMarks(e.target.value)}
        />
      </Field>
      <Field id="settings-due" label="Due (IST)" optional error={errors.dueAt}>
        <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <SubmissionPolicyFields
        idPrefix="settings"
        allowLate={allowLate}
        setAllowLate={setAllowLate}
        allowResubmission={allowResubmission}
        setAllowResubmission={setAllowResubmission}
      />
      <Button type="submit" loading={pending} loadingText="Saving…">
        {assignment.settings ? 'Save settings' : 'Open online submission'}
      </Button>
    </form>
  );
}

// --- Submissions ----------------------------------------------------------------------------

const FILTER_LABELS: Record<(typeof SUBMISSION_FILTERS)[number], string> = {
  SUBMITTED: REVIEW_STATE_LABELS.AWAITING_REVIEW,
  GRADED: REVIEW_STATE_LABELS.GRADED,
  RELEASED: REVIEW_STATE_LABELS.RELEASED,
};

export function SubmissionsTable({ lessonId }: { lessonId?: string }) {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [course, setCourse] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [sort, setSort] = React.useState<'oldest' | 'newest'>('oldest');
  const path = withQuery('/faculty/submissions', {
    page,
    pageSize: 20,
    lessonId,
    courseId: lessonId ? undefined : course,
    status,
    sort,
  });
  const list = useApiResource(path, () => api.get<Paginated<SubmissionListItem>>(path));
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
        {lessonId ? null : (
          <CourseFilter id="submissions-course" value={course} onChange={reset(setCourse)} />
        )}
        <SelectField
          id="submissions-status"
          label="Review state"
          value={status || 'all'}
          onValueChange={reset((value: string) => setStatus(value === 'all' ? '' : value))}
          options={[
            { value: 'all', label: 'All' },
            ...SUBMISSION_FILTERS.map((value) => ({ value, label: FILTER_LABELS[value] })),
          ]}
        />
        <SelectField
          id="submissions-sort"
          label="Order"
          value={sort}
          onValueChange={reset((value: string) => setSort(value as 'oldest' | 'newest'))}
          options={[
            { value: 'oldest', label: 'Oldest first' },
            { value: 'newest', label: 'Newest first' },
          ]}
        />
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading submissions…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="No submissions"
          description={
            status
              ? 'Nothing matches this filter.'
              : 'Student submissions appear here as they arrive.'
          }
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Submissions">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/faculty/submissions/${item.id}`}
                      className="rounded-sm font-medium text-heading hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {item.student.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="grid">
                      <span>{item.assignment.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {item.course.title}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      {formatDateTime(item.submittedAt)}
                      {item.late ? <LateBadge /> : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ReviewBadge item={item} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMarks(item.marksAwarded, item.assignment.maxMarks) ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label="Submission pages"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function SubmissionsPage() {
  return (
    <>
      <PageHeader
        title="Submissions"
        breadcrumbs={[home, { label: 'Submissions' }]}
        description="Review student work, record marks and feedback, then release results to students."
      />
      <SubmissionsTable />
    </>
  );
}

/** Review one submission: the student's original work, marks + feedback, and result release. */
export function SubmissionReview({ id }: { id: string }) {
  const api = useFacultyApi();
  const path = `/faculty/submissions/${id}`;
  const submission = useApiResource(path, () => api.get<SubmissionDetailDto>(path));
  const [releasing, setReleasing] = React.useState(false);

  if (submission.error && !submission.data) {
    const denied = submission.error instanceof ApiClientError && submission.error.status === 403;
    return (
      <>
        <PageHeader title="Submission" breadcrumbs={[home, submissionsCrumb, { label: 'Error' }]} />
        <ErrorPanel
          title={denied ? 'No access' : undefined}
          message={errorMessage(submission.error)}
          onRetry={denied ? undefined : submission.reload}
        />
      </>
    );
  }
  if (!submission.data) return <LoadingPanel label="Loading submission…" rows={6} />;
  const data = submission.data;
  const state = reviewState(data);

  return (
    <>
      <PageHeader
        title={`${data.student.fullName} · ${data.assignment.title}`}
        breadcrumbs={[home, submissionsCrumb, { label: data.student.fullName }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ReviewBadge item={data} />
            {data.late ? <LateBadge /> : null}
            {data.version > 1 ? <Badge variant="secondary">Version {data.version}</Badge> : null}
            <span>
              {data.course.title} · submitted {formatDateTime(data.submittedAt)} IST
              {data.assignment.dueAt ? ` · due ${formatDateTime(data.assignment.dueAt)} IST` : ''}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/faculty/assignments/${data.assignment.lessonId}`}>Assignment</Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-labelledby="work-heading" className="grid gap-3">
          <h2 id="work-heading" className="type-h3 text-heading">
            Submitted work
          </h2>
          {/* Student text is rendered as text, never as HTML. */}
          <div className="rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
            {data.body}
          </div>
          {data.attachmentUrl ? (
            <a
              href={data.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 type-body-sm text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden /> Open the attached link
            </a>
          ) : null}
          {data.revisions.length > 0 ? (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer type-label">
                Earlier versions ({data.revisions.length})
              </summary>
              <ol className="mt-3 grid gap-3">
                {data.revisions.map((revision) => (
                  <li key={revision.version} className="grid gap-1 border-t pt-3">
                    <span className="type-caption text-muted-foreground">
                      Version {revision.version} · {formatDateTime(revision.submittedAt)} IST
                      {revision.late ? ' · late' : ''}
                    </span>
                    <p className="type-body-sm break-words whitespace-pre-wrap">{revision.body}</p>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          {data.gradeHistory.length > 0 ? (
            <section aria-labelledby="history-heading" className="grid gap-2">
              <h3 id="history-heading" className="type-h4 text-heading">
                Grading history
              </h3>
              <ol className="grid gap-1 type-body-sm">
                {data.gradeHistory.map((entry) => (
                  <li key={`${entry.at}-${entry.action}`}>
                    {formatDateTime(entry.at)} IST — {entry.by ?? 'Unknown'}{' '}
                    {entry.action === 'released'
                      ? `released the result (${entry.marksAwarded ?? '—'})`
                      : entry.action === 'regraded'
                        ? `changed marks ${entry.previousMarks} → ${entry.marksAwarded}`
                        : `graded ${entry.marksAwarded}`}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </section>
        <div className="grid gap-4">
          <GradeForm
            key={data.updatedAt}
            submission={data}
            onSaved={submission.replace}
            locked={state === 'RELEASED'}
          />
          {state === 'RELEASED' ? (
            <Alert tone="success" title="Result released">
              <p>
                The student can see these marks and feedback since{' '}
                {formatDateTime(data.resultReleasedAt)} IST. Released results are final.
              </p>
            </Alert>
          ) : (
            <div className="grid gap-2 rounded-xl border bg-card p-5">
              <p className="type-body-sm text-muted-foreground">
                Saved marks stay private until you release the result to the student.
              </p>
              <Button
                variant="outline"
                disabled={state !== 'GRADED'}
                onClick={() => setReleasing(true)}
              >
                Release result to student
              </Button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={releasing}
        onOpenChange={setReleasing}
        title="Release this result?"
        description={`${data.student.fullName} will see ${formatMarks(data.marksAwarded, data.assignment.maxMarks) ?? ''} and your feedback. A released result cannot be changed.`}
        confirmLabel="Release result"
        pendingLabel="Releasing…"
        onConfirm={async () => {
          try {
            const released = await api.post<SubmissionDetailDto>(
              `/faculty/submissions/${id}/release`,
            );
            submission.replace(released);
            toast.success('Result released', { description: data.student.fullName });
          } catch (error) {
            toast.error('Could not release the result', { description: errorMessage(error) });
            submission.reload();
            throw error;
          }
        }}
      />
    </>
  );
}

function GradeForm({
  submission,
  onSaved,
  locked,
}: {
  submission: SubmissionDetailDto;
  onSaved: (data: SubmissionDetailDto) => void;
  locked: boolean;
}) {
  const api = useFacultyApi();
  const [marks, setMarks] = React.useState(
    submission.marksAwarded === null ? '' : String(submission.marksAwarded),
  );
  const [feedback, setFeedback] = React.useState(submission.feedback ?? '');
  const [note, setNote] = React.useState(submission.facultyNote ?? '');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const max = submission.assignment.maxMarks;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || locked) return;
    const parsed = validateForm(gradeSubmissionSchema, {
      marksAwarded: marks.trim() === '' ? undefined : Number(marks),
      feedback,
      facultyNote: note,
      expectedUpdatedAt: submission.updatedAt,
    });
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    // Convenience check only — the API validates against the assignment's maximum.
    if (parsed.data.marksAwarded > max) {
      return setErrors({ marksAwarded: `Marks cannot exceed the maximum of ${max}` });
    }
    setErrors({});
    setPending(true);
    try {
      const saved = await api.put<SubmissionDetailDto>(
        `/faculty/submissions/${submission.id}/grade`,
        parsed.data,
      );
      toast.success('Marks and feedback saved', { description: 'Not visible to the student yet.' });
      onSaved(saved);
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="grade-heading"
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="grade-heading" className="type-h4 text-heading">
        Marks and feedback
      </h2>
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <Field id="grade-marks" label={`Marks (0–${max})`} error={errors.marksAwarded}>
        <Input
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          value={marks}
          disabled={locked}
          onChange={(e) => setMarks(e.target.value)}
        />
      </Field>
      <Field id="grade-feedback" label="Feedback" optional error={errors.feedback}>
        <Textarea
          value={feedback}
          rows={5}
          disabled={locked}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </Field>
      <Field
        id="grade-note"
        label="Private note"
        optional
        error={errors.facultyNote}
        hint="Only faculty of this course can see it — never the student."
      >
        <Textarea
          value={note}
          rows={2}
          disabled={locked}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {submission.gradedAt ? (
        <p className="type-caption text-muted-foreground">
          Last graded {formatDateTime(submission.gradedAt)} IST
          {submission.gradedBy ? ` by ${submission.gradedBy}` : ''}.
        </p>
      ) : null}
      {locked ? null : (
        <Button type="submit" loading={pending} loadingText="Saving…">
          {submission.status === 'GRADED' ? 'Update marks' : 'Save marks'}
        </Button>
      )}
    </form>
  );
}
