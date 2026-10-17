'use client';

import type { AnswerReveal, FacultyExamDetail, FacultyExamItem, Paginated } from '@asra/types';
import { ANSWER_REVEALS, examCreateSchema, examUpdateSchema } from '@asra/validation';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CheckboxField, ConfirmDialog, SelectField } from '@/components/admin/admin-ui';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
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
import { ANSWER_REVEAL_LABELS, formatMarksValue } from '@/lib/assessments';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';
import { istInputToIso, isoToIstInput } from '@/lib/faculty/portal';

import {
  AssessmentStatusBadge,
  AttemptCountsLabel,
  AttemptsTable,
  QuestionEditor,
  TransitionButtons,
} from './assessment-builder';
import {
  CourseFilter,
  ErrorPanel,
  LoadingPanel,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

/**
 * Faculty examinations (PHASE 09). Times are entered and shown in IST (V-09) and sent with an
 * explicit offset; the API stores UTC and enforces the window, durations and deadlines itself.
 */

const home = { label: 'Dashboard', href: '/faculty/dashboard' };
const examsCrumb = { label: 'Exams', href: '/faculty/exams' };

export function ExamsPage() {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [course, setCourse] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const path = withQuery('/faculty/exams', { page, pageSize: 20, courseId: course });
  const list = useApiResource(path, () => api.get<Paginated<FacultyExamItem>>(path));
  return (
    <>
      <PageHeader
        title="Exams"
        breadcrumbs={[home, { label: 'Exams' }]}
        description="Scheduled, timed examinations of your courses. The server enforces the window and every student's deadline."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New exam
          </Button>
        }
      />
      <div className="w-full max-w-sm">
        <CourseFilter
          id="exams-course"
          value={course}
          onChange={(value) => {
            setCourse(value);
            setPage(1);
          }}
        />
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading exams…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No exams yet"
          description="Schedule an examination for one of your courses."
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Exams">
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window (IST)</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/faculty/exams/${item.id}`}
                      className="grid rounded-sm hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="font-medium text-heading hover:underline">{item.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {item.course.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AssessmentStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="type-body-sm">
                    {formatDateTime(item.opensAt)} – {formatDateTime(item.closesAt)}
                    <span className="block type-caption text-muted-foreground">
                      {item.durationMinutes} min per attempt
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.questionCount} · {formatMarksValue(item.totalMarks)} marks
                  </TableCell>
                  <TableCell>
                    <AttemptCountsLabel counts={item.attempts} />
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
              label="Exam pages"
            />
          ) : null}
        </div>
      )}
      {creating ? <ExamDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

interface ExamFormState {
  title: string;
  instructions: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: string;
  maxAttempts: string;
  passPercent: string;
  negativeMarking: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  answerReveal: AnswerReveal;
}

function formFrom(exam?: FacultyExamDetail): ExamFormState {
  return {
    title: exam?.title ?? '',
    instructions: exam?.instructions ?? '',
    opensAt: isoToIstInput(exam?.opensAt),
    closesAt: isoToIstInput(exam?.closesAt),
    durationMinutes: exam ? String(exam.durationMinutes) : '60',
    maxAttempts: exam ? String(exam.maxAttempts) : '1',
    passPercent: exam ? String(exam.passPercent) : '40',
    negativeMarking: exam?.negativeMarking ?? false,
    shuffleQuestions: exam?.shuffleQuestions ?? false,
    shuffleOptions: exam?.shuffleOptions ?? false,
    answerReveal: exam?.answerReveal ?? 'NEVER',
  };
}

/** Form → request body; `undefined` times mean "invalid input" (reported on the field). */
function toBody(form: ExamFormState) {
  return {
    title: form.title,
    instructions: form.instructions,
    opensAt: istInputToIso(form.opensAt) ?? undefined,
    closesAt: istInputToIso(form.closesAt) ?? undefined,
    durationMinutes: Number(form.durationMinutes),
    maxAttempts: Number(form.maxAttempts),
    passPercent: Number(form.passPercent),
    negativeMarking: form.negativeMarking,
    shuffleQuestions: form.shuffleQuestions,
    shuffleOptions: form.shuffleOptions,
    answerReveal: form.answerReveal,
  };
}

function ExamFields({
  form,
  set,
  errors,
  disabled,
}: {
  form: ExamFormState;
  set: (patch: Partial<ExamFormState>) => void;
  errors: FieldErrors;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-4">
      <Field id="exam-title" label="Title" error={errors.title}>
        <Input
          value={form.title}
          maxLength={200}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field id="exam-instructions" label="Instructions" optional error={errors.instructions}>
        <Textarea
          rows={4}
          value={form.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="exam-opens" label="Opens (IST)" error={errors.opensAt}>
          <Input
            type="datetime-local"
            value={form.opensAt}
            onChange={(e) => set({ opensAt: e.target.value })}
          />
        </Field>
        <Field
          id="exam-closes"
          label="Closes (IST)"
          error={errors.closesAt}
          hint="No attempt can start or continue after this."
        >
          <Input
            type="datetime-local"
            value={form.closesAt}
            onChange={(e) => set({ closesAt: e.target.value })}
          />
        </Field>
        <Field
          id="exam-duration"
          label="Duration per attempt (minutes)"
          error={errors.durationMinutes}
          hint="Cut short if the exam closes earlier."
        >
          <Input
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            value={form.durationMinutes}
            onChange={(e) => set({ durationMinutes: e.target.value })}
          />
        </Field>
        <Field id="exam-attempts" label="Attempts per student" error={errors.maxAttempts}>
          <Input
            type="number"
            min={1}
            max={5}
            inputMode="numeric"
            value={form.maxAttempts}
            onChange={(e) => set({ maxAttempts: e.target.value })}
          />
        </Field>
        <Field id="exam-pass" label="Pass mark (%)" error={errors.passPercent}>
          <Input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={form.passPercent}
            onChange={(e) => set({ passPercent: e.target.value })}
          />
        </Field>
        <SelectField
          id="exam-reveal"
          label="Show correct answers (after results are published)"
          value={form.answerReveal}
          onValueChange={(value) => set({ answerReveal: value as AnswerReveal })}
          options={ANSWER_REVEALS.map((value) => ({ value, label: ANSWER_REVEAL_LABELS[value] }))}
          error={errors.answerReveal}
        />
      </div>
      <CheckboxField
        id="exam-negative"
        label="Negative marking"
        checked={form.negativeMarking}
        onChange={(value) => set({ negativeMarking: value })}
      />
      <CheckboxField
        id="exam-shuffle-q"
        label="Shuffle question order"
        checked={form.shuffleQuestions}
        onChange={(value) => set({ shuffleQuestions: value })}
      />
      <CheckboxField
        id="exam-shuffle-o"
        label="Shuffle answer options"
        checked={form.shuffleOptions}
        onChange={(value) => set({ shuffleOptions: value })}
      />
    </fieldset>
  );
}

function ExamDialog({ onClose }: { onClose: () => void }) {
  const api = useFacultyApi();
  const router = useRouter();
  const [courseId, setCourseId] = React.useState('');
  const [form, setForm] = React.useState(() => formFrom());
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(examCreateSchema, toBody(form));
    const local: FieldErrors = { ...(parsed.errors ?? {}) };
    if (!courseId) local.courseId = 'Choose the course';
    setFormError(null);
    if (Object.keys(local).length > 0 || !parsed.data) return setErrors(local);
    setErrors({});
    setPending(true);
    try {
      const created = await api.post<FacultyExamDetail>(
        `/faculty/courses/${courseId}/exams`,
        parsed.data,
      );
      toast.success('Exam created as a draft', { description: 'Add questions, then publish it.' });
      router.push(`/faculty/exams/${created.id}`);
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New exam</DialogTitle>
          <DialogDescription>
            Saved as a draft. Students see it only after you publish it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <CourseFilter id="exam-course" value={courseId} allLabel={null} onChange={setCourseId} />
          {errors.courseId ? (
            <p className="type-body-sm text-destructive">{errors.courseId}</p>
          ) : null}
          <ExamFields form={form} set={(patch) => setForm({ ...form, ...patch })} errors={errors} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Creating…">
              Create exam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Workspace ------------------------------------------------------------------------------

export function ExamWorkspace({ examId }: { examId: string }) {
  const api = useFacultyApi();
  const router = useRouter();
  const path = `/faculty/exams/${examId}`;
  const detail = useApiResource(path, () => api.get<FacultyExamDetail>(path));
  const [publishing, setPublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  if (detail.error && !detail.data) {
    const denied = detail.error instanceof ApiClientError && detail.error.status === 403;
    return (
      <>
        <PageHeader title="Exam" breadcrumbs={[home, examsCrumb, { label: 'Error' }]} />
        <ErrorPanel
          title={denied ? 'No access' : undefined}
          message={errorMessage(detail.error)}
          onRetry={denied ? undefined : detail.reload}
        />
      </>
    );
  }
  if (!detail.data) return <LoadingPanel label="Loading exam…" rows={6} />;
  const data = detail.data;
  const editable = data.status === 'DRAFT';
  const canPublishResults =
    data.status !== 'DRAFT' &&
    !data.resultsPublishedAt &&
    data.windowEnded &&
    data.attempts.inProgress === 0 &&
    data.attempts.pendingEvaluation === 0;

  async function processExpired() {
    setProcessing(true);
    try {
      const { finalized } = await api.post<{ finalized: number }>(
        `/faculty/exams/${examId}/process-expired`,
      );
      toast.success(
        finalized
          ? `${finalized} expired attempt${finalized === 1 ? '' : 's'} finalized`
          : 'No expired attempts to process',
      );
      detail.reload();
    } catch (error) {
      toast.error('Could not process attempts', { description: errorMessage(error) });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={data.title}
        breadcrumbs={[home, examsCrumb, { label: data.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AssessmentStatusBadge status={data.status} />
            <span>
              {data.course.title} · {formatDateTime(data.opensAt)} – {formatDateTime(data.closesAt)}{' '}
              IST · {data.durationMinutes} min · {data.activeStudents} enrolled
            </span>
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <TransitionButtons<FacultyExamDetail>
              status={data.status}
              attempts={data.attempts.total}
              path={`/faculty/exams/${examId}/status`}
              closeNote="Attempts already running keep their deadlines."
              onDone={detail.replace}
            />
            {editable ? (
              <Button variant="ghost" onClick={() => setDeleting(true)}>
                Delete draft
              </Button>
            ) : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <QuestionEditor
          kind="EXAM"
          questions={data.questions}
          editable={editable}
          addPath={`/faculty/exams/${examId}/questions`}
          orderPath={`/faculty/exams/${examId}/question-order`}
          onChanged={detail.reload}
        />
        <div className="grid gap-4">
          <ExamSettingsForm key={data.updatedAt} exam={data} onSaved={detail.replace} />
          {data.status !== 'DRAFT' ? (
            <div className="grid gap-3 rounded-xl border bg-card p-5">
              <h2 className="type-h4 text-heading">Results</h2>
              <p className="type-body-sm text-muted-foreground">
                {data.attempts.total} attempts · {data.attempts.inProgress} running ·{' '}
                {data.attempts.pendingEvaluation} awaiting grading · {data.attempts.evaluated}{' '}
                evaluated
              </p>
              {data.resultsPublishedAt ? (
                <Alert tone="success" title="Results published">
                  <p>
                    Students can see their results since {formatDateTime(data.resultsPublishedAt)}{' '}
                    IST. Marks can no longer change.
                  </p>
                </Alert>
              ) : (
                <>
                  {!data.windowEnded ? (
                    <p className="type-caption text-muted-foreground">
                      Results can be published after the exam closes.
                    </p>
                  ) : data.attempts.pendingEvaluation > 0 ? (
                    <p className="type-caption text-warning">
                      Grade the written answers before publishing.
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={!canPublishResults}
                    onClick={() => setPublishing(true)}
                  >
                    Publish results
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                className="w-fit"
                onClick={() => void processExpired()}
                loading={processing}
                loadingText="Processing…"
              >
                <RefreshCw aria-hidden /> Finalize expired attempts now
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {data.status !== 'DRAFT' ? (
        <AttemptsTable path={`/faculty/exams/${examId}/attempts`} />
      ) : null}
      <ConfirmDialog
        open={publishing}
        onOpenChange={setPublishing}
        title="Publish exam results?"
        description="Every student will see their score. Marks cannot be changed afterwards."
        confirmLabel="Publish results"
        pendingLabel="Publishing…"
        onConfirm={async () => {
          try {
            detail.replace(
              await api.post<FacultyExamDetail>(`/faculty/exams/${examId}/publish-results`),
            );
            toast.success('Results published');
          } catch (error) {
            toast.error('Could not publish results', { description: errorMessage(error) });
            detail.reload();
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this draft exam?"
        description="The exam and its questions are deleted. This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        destructive
        onConfirm={async () => {
          try {
            await api.del(`/faculty/exams/${examId}`);
            toast.success('Exam deleted');
            router.push('/faculty/exams');
          } catch (error) {
            toast.error('Could not delete', { description: errorMessage(error) });
            throw error;
          }
        }}
      />
    </>
  );
}

function ExamSettingsForm({
  exam,
  onSaved,
}: {
  exam: FacultyExamDetail;
  onSaved: (exam: FacultyExamDetail) => void;
}) {
  const api = useFacultyApi();
  const [form, setForm] = React.useState(() => formFrom(exam));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const editable = exam.status === 'DRAFT';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !editable) return;
    const parsed = validateForm(examUpdateSchema, toBody(form));
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      onSaved(await api.patch<FacultyExamDetail>(`/faculty/exams/${exam.id}`, parsed.data));
      setDirty(false);
      toast.success('Exam saved');
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
      aria-labelledby="exam-settings-heading"
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="exam-settings-heading" className="type-h4 text-heading">
        Schedule and rules
      </h2>
      {!editable ? (
        <p className="type-caption text-muted-foreground">Fixed while the exam is published.</p>
      ) : null}
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <ExamFields
        form={form}
        set={(patch) => {
          setForm({ ...form, ...patch });
          setDirty(true);
        }}
        errors={errors}
        disabled={!editable}
      />
      {editable ? (
        <Button type="submit" loading={pending} loadingText="Saving…">
          Save exam
        </Button>
      ) : null}
      {dirty && editable ? (
        <p className="type-caption text-warning">You have unsaved changes.</p>
      ) : null}
    </form>
  );
}
