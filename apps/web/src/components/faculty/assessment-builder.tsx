'use client';

import type {
  AssessmentStatus,
  AttemptCounts,
  FacultyAttemptItem,
  Paginated,
  QuestionDto,
  QuestionType,
} from '@asra/types';
import {
  ATTEMPT_FILTERS,
  QUESTION_LIMITS,
  questionInputSchema,
  type AssessmentTransition,
} from '@asra/validation';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ConfirmDialog, SelectField } from '@/components/admin/admin-ui';
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
import {
  ASSESSMENT_STATUS_BADGE,
  ASSESSMENT_STATUS_LABELS,
  ATTEMPT_STATUS_LABELS,
  formatMarksValue,
  formatScore,
  QUESTION_TYPE_LABELS,
} from '@/lib/assessments';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';

import {
  ErrorPanel,
  LoadingPanel,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

/**
 * Building blocks shared by the quiz and examination workspaces (PHASE 09). They render API data
 * and send requests; every rule (draft-only editing, valid transitions, scoring) is enforced by the
 * API, which reports refusals that are shown here as they are.
 */

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <Badge variant={ASSESSMENT_STATUS_BADGE[status]}>{ASSESSMENT_STATUS_LABELS[status]}</Badge>
  );
}

export function AttemptCountsLabel({ counts }: { counts: AttemptCounts }) {
  return (
    <span className="type-body-sm tabular-nums">
      {counts.total} attempt{counts.total === 1 ? '' : 's'}
      {counts.inProgress ? ` · ${counts.inProgress} running` : ''}
      {counts.pendingEvaluation ? ` · ${counts.pendingEvaluation} to grade` : ''}
    </span>
  );
}

// --- Lifecycle ------------------------------------------------------------------------------

const TRANSITIONS: Record<
  AssessmentTransition,
  { label: string; title: string; description: string; destructive?: boolean }
> = {
  publish: {
    label: 'Publish',
    title: 'Publish for students?',
    description: 'Students can attempt it under these rules. Questions and rules are then frozen.',
  },
  close: {
    label: 'Close',
    title: 'Close to new attempts?',
    description: 'No new attempts can start. Results and history are kept.',
    destructive: true,
  },
  reopen: {
    label: 'Reopen',
    title: 'Reopen for attempts?',
    description: 'Students with attempts left can start again.',
  },
  unpublish: {
    label: 'Back to draft',
    title: 'Move back to draft?',
    description: 'Only possible before anyone has attempted it. Students will no longer see it.',
  },
};

export function availableTransitions(
  status: AssessmentStatus,
  attempts: number,
): AssessmentTransition[] {
  if (status === 'DRAFT') return ['publish'];
  if (status === 'PUBLISHED') return attempts === 0 ? ['close', 'unpublish'] : ['close'];
  return ['reopen'];
}

export function TransitionButtons<T>({
  status,
  attempts,
  path,
  closeNote,
  onDone,
}: {
  status: AssessmentStatus;
  attempts: number;
  path: string;
  closeNote?: string;
  onDone: (data: T) => void;
}) {
  const api = useFacultyApi();
  const [action, setAction] = React.useState<AssessmentTransition | null>(null);
  const current = action ? TRANSITIONS[action] : null;
  return (
    <>
      {availableTransitions(status, attempts).map((next) => (
        <Button
          key={next}
          variant={next === 'publish' ? 'default' : 'outline'}
          onClick={() => setAction(next)}
        >
          {TRANSITIONS[next].label}
        </Button>
      ))}
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={current?.title ?? ''}
        description={
          action === 'close' && closeNote
            ? `${current?.description} ${closeNote}`
            : (current?.description ?? '')
        }
        confirmLabel={current?.label ?? ''}
        pendingLabel="Saving…"
        destructive={current?.destructive}
        onConfirm={async () => {
          try {
            const data = await api.post<T>(path, { action });
            toast.success('Status updated');
            onDone(data);
          } catch (error) {
            toast.error('Could not change the status', { description: errorMessage(error) });
            throw error;
          }
        }}
      />
    </>
  );
}

// --- Questions ------------------------------------------------------------------------------

interface DraftOption {
  text: string;
  isCorrect: boolean;
}

const TRUE_FALSE_OPTIONS: DraftOption[] = [
  { text: 'True', isCorrect: true },
  { text: 'False', isCorrect: false },
];

function blankOptions(type: QuestionType): DraftOption[] {
  if (type === 'SHORT_ANSWER') return [];
  if (type === 'TRUE_FALSE') return TRUE_FALSE_OPTIONS.map((o) => ({ ...o }));
  return [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ];
}

export function QuestionEditor({
  kind,
  questions,
  editable,
  addPath,
  orderPath,
  onChanged,
}: {
  kind: 'QUIZ' | 'EXAM';
  questions: QuestionDto[];
  editable: boolean;
  addPath: string;
  orderPath: string;
  onChanged: () => void;
}) {
  const api = useFacultyApi();
  const [editing, setEditing] = React.useState<QuestionDto | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<QuestionDto | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const total = questions.reduce((sum, q) => sum + q.marks, 0);

  async function move(index: number, delta: -1 | 1) {
    const ids = questions.map((q) => q.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length || moving) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setMoving(true);
    try {
      await api.put(orderPath, { questionIds: ids });
      onChanged();
    } catch (error) {
      toast.error('Could not reorder', { description: errorMessage(error) });
    } finally {
      setMoving(false);
    }
  }

  return (
    <section aria-labelledby="questions-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="questions-heading" className="type-h2 text-heading">
          Questions{' '}
          <span className="type-body-sm font-normal text-muted-foreground">
            {questions.length} · {formatMarksValue(total)} marks
          </span>
        </h2>
        <span className="flex flex-wrap gap-2">
          {questions.length > 0 ? (
            <Button variant="outline" onClick={() => setPreviewing(true)}>
              <Eye aria-hidden /> Preview as student
            </Button>
          ) : null}
          {editable ? (
            <Button
              onClick={() => setEditing('new')}
              disabled={questions.length >= QUESTION_LIMITS.questionsPerAssessment}
            >
              <Plus aria-hidden /> Add question
            </Button>
          ) : null}
        </span>
      </div>
      {!editable ? (
        <Alert tone="info">
          <p>
            Questions are frozen while students can attempt this {kind === 'QUIZ' ? 'quiz' : 'exam'}
            . Every attempt keeps its own copy of the questions it was given.
          </p>
        </Alert>
      ) : null}
      {questions.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No questions yet"
          description="Add the questions students will answer."
        />
      ) : (
        <ol className="grid gap-3" aria-busy={moving || undefined}>
          {questions.map((question, index) => (
            <li key={question.id} className="grid gap-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="grid min-w-0 gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-label text-heading">Q{index + 1}</span>
                    <Badge variant="outline">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                    <Badge variant="secondary">
                      {formatMarksValue(question.marks)} marks
                      {question.negativeMarks > 0
                        ? ` · −${formatMarksValue(question.negativeMarks)}`
                        : ''}
                    </Badge>
                  </span>
                  <span className="type-body break-words whitespace-pre-wrap">
                    {question.prompt}
                  </span>
                </span>
                {editable ? (
                  <span className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move question ${index + 1} up`}
                      disabled={index === 0 || moving}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move question ${index + 1} down`}
                      disabled={index === questions.length - 1 || moving}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit question ${index + 1}`}
                      onClick={() => setEditing(question)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete question ${index + 1}`}
                      onClick={() => setDeleting(question)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                ) : null}
              </div>
              {question.options.length > 0 ? (
                <ul className="grid gap-1 type-body-sm">
                  {question.options.map((option) => (
                    <li key={option.id} className="flex items-center gap-2">
                      {option.isCorrect ? (
                        <CheckCircle2 className="size-4 text-success" aria-label="Correct" />
                      ) : (
                        <span className="size-4" aria-hidden />
                      )}
                      <span className={option.isCorrect ? 'font-semibold' : undefined}>
                        {option.text}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="type-caption text-muted-foreground">
                  Written answer — graded by faculty.
                </p>
              )}
              {question.explanation ? (
                <p className="type-caption whitespace-pre-line text-muted-foreground">
                  Explanation: {question.explanation}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {editing ? (
        <QuestionDialog
          kind={kind}
          question={editing === 'new' ? null : editing}
          addPath={addPath}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteQuestion
          question={deleting}
          onDone={() => {
            setDeleting(null);
            onChanged();
          }}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
      {previewing ? (
        <QuestionPreview questions={questions} onClose={() => setPreviewing(false)} />
      ) : null}
    </section>
  );
}

function DeleteQuestion({
  question,
  onDone,
  onCancel,
}: {
  question: QuestionDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const api = useFacultyApi();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title="Delete this question?"
      description="It is removed from this draft. Attempts already made keep their own copy."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      onConfirm={async () => {
        try {
          await api.del(`/faculty/questions/${question.id}`);
          toast.success('Question deleted');
          onDone();
        } catch (error) {
          toast.error('Could not delete', { description: errorMessage(error) });
          throw error;
        }
      }}
    />
  );
}

function QuestionDialog({
  kind,
  question,
  addPath,
  onClose,
  onSaved,
}: {
  kind: 'QUIZ' | 'EXAM';
  question: QuestionDto | null;
  addPath: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useFacultyApi();
  const [type, setType] = React.useState<QuestionType>(question?.type ?? 'SINGLE_CHOICE');
  const [prompt, setPrompt] = React.useState(question?.prompt ?? '');
  const [explanation, setExplanation] = React.useState(question?.explanation ?? '');
  const [marks, setMarks] = React.useState(question ? String(question.marks) : '1');
  const [negative, setNegative] = React.useState(question ? String(question.negativeMarks) : '0');
  const [options, setOptions] = React.useState<DraftOption[]>(
    question
      ? question.options.map(({ text, isCorrect }) => ({ text, isCorrect }))
      : blankOptions('SINGLE_CHOICE'),
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const types: QuestionType[] =
    kind === 'QUIZ'
      ? ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE']
      : ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER'];
  const choice = type !== 'SHORT_ANSWER';
  const multiple = type === 'MULTIPLE_CHOICE';

  function changeType(next: QuestionType) {
    setType(next);
    if (
      next === 'TRUE_FALSE' ||
      next === 'SHORT_ANSWER' ||
      options.length === 0 ||
      type === 'TRUE_FALSE'
    ) {
      setOptions(blankOptions(next));
    } else if (next !== 'MULTIPLE_CHOICE') {
      const first = options.findIndex((o) => o.isCorrect);
      setOptions(options.map((o, i) => ({ ...o, isCorrect: i === Math.max(first, 0) })));
    }
    if (next === 'SHORT_ANSWER') setNegative('0');
  }

  function markCorrect(index: number) {
    setOptions(
      options.map((o, i) =>
        multiple
          ? i === index
            ? { ...o, isCorrect: !o.isCorrect }
            : o
          : { ...o, isCorrect: i === index },
      ),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(questionInputSchema, {
      type,
      prompt,
      explanation,
      marks: marks.trim() === '' ? undefined : Number(marks),
      negativeMarks: negative.trim() === '' ? 0 : Number(negative),
      options: choice ? options : [],
    });
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      if (question) await api.patch(`/faculty/questions/${question.id}`, parsed.data);
      else await api.post(addPath, parsed.data);
      toast.success(question ? 'Question saved' : 'Question added');
      onSaved();
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit question' : 'Add question'}</DialogTitle>
          <DialogDescription>
            Plain text only. Scoring is done by the server from the answer key you set here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <SelectField
            id="question-type"
            label="Question type"
            value={type}
            onValueChange={(value) => changeType(value as QuestionType)}
            options={types.map((value) => ({ value, label: QUESTION_TYPE_LABELS[value] }))}
            error={errors.type}
            hint={
              kind === 'QUIZ'
                ? 'Written answers need manual grading and are available in exams only.'
                : undefined
            }
          />
          <Field id="question-prompt" label="Question" error={errors.prompt}>
            <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="question-marks"
              label="Marks"
              error={errors.marks}
              hint="Up to two decimals, e.g. 2 or 0.5."
            >
              <Input
                type="number"
                min={0.25}
                max={100}
                step={0.25}
                inputMode="decimal"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </Field>
            <Field
              id="question-negative"
              label="Negative marks for a wrong answer"
              error={errors.negativeMarks}
              hint="Applied only if negative marking is switched on. 0 = none."
            >
              <Input
                type="number"
                min={0}
                step={0.25}
                inputMode="decimal"
                value={negative}
                disabled={!choice}
                onChange={(e) => setNegative(e.target.value)}
              />
            </Field>
          </div>
          {choice ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 type-label">
                Options — mark {multiple ? 'every correct option' : 'the correct option'}
              </legend>
              {errors.options ? (
                <p className="type-body-sm text-destructive">{errors.options}</p>
              ) : null}
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name="correct-option"
                    aria-label={`Option ${index + 1} is correct`}
                    checked={option.isCorrect}
                    onChange={() => markCorrect(index)}
                    className="size-4 accent-primary"
                  />
                  <Input
                    aria-label={`Option ${index + 1}`}
                    value={option.text}
                    maxLength={QUESTION_LIMITS.optionLength}
                    readOnly={type === 'TRUE_FALSE'}
                    onChange={(e) =>
                      setOptions(
                        options.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)),
                      )
                    }
                  />
                  {type !== 'TRUE_FALSE' && options.length > QUESTION_LIMITS.options.min ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              {type !== 'TRUE_FALSE' && options.length < QUESTION_LIMITS.options.max ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit"
                  onClick={() => setOptions([...options, { text: '', isCorrect: false }])}
                >
                  <Plus aria-hidden /> Add option
                </Button>
              ) : null}
              {multiple ? (
                <p className="type-caption text-muted-foreground">
                  Scored all-or-nothing: the student must choose exactly the correct options.
                </p>
              ) : null}
            </fieldset>
          ) : null}
          <Field
            id="question-explanation"
            label="Explanation"
            optional
            error={errors.explanation}
            hint="Shown with the correct answer when answers are revealed."
          >
            <Textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              {question ? 'Save question' : 'Add question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What students will see: the questions and options without the answer key. */
function QuestionPreview({
  questions,
  onClose,
}: {
  questions: QuestionDto[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student preview</DialogTitle>
          <DialogDescription>
            Correct answers are hidden, as for students. With shuffling on, the order differs per
            attempt.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-4">
          {questions.map((q, i) => (
            <li key={q.id} className="grid gap-2 rounded-lg border p-3">
              <span className="type-label">
                {i + 1}. <span className="whitespace-pre-wrap">{q.prompt}</span>
              </span>
              {q.type === 'SHORT_ANSWER' ? (
                <Textarea rows={2} disabled aria-label="Written answer (preview)" />
              ) : (
                <ul className="grid gap-1">
                  {q.options.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 type-body-sm">
                      <input
                        type={q.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                        disabled
                        aria-label={o.text}
                        className="size-4"
                      />
                      {o.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button onClick={onClose}>Close preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Attempts -------------------------------------------------------------------------------

const ATTEMPT_FILTER_LABELS: Record<(typeof ATTEMPT_FILTERS)[number], string> = {
  IN_PROGRESS: 'In progress',
  PENDING_EVALUATION: 'Needs grading',
  EVALUATED: 'Evaluated',
};

export function AttemptsTable({ path }: { path: string }) {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const url = withQuery(path, { page, pageSize: 20, status });
  const list = useApiResource(url, () => api.get<Paginated<FacultyAttemptItem>>(url));
  return (
    <section aria-labelledby="attempts-heading" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="attempts-heading" className="type-h2 text-heading">
          Attempts
        </h2>
        <div className="w-full max-w-xs">
          <SelectField
            id="attempts-status"
            label="Show"
            value={status || 'all'}
            onValueChange={(value) => {
              setStatus(value === 'all' ? '' : value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All attempts' },
              ...ATTEMPT_FILTERS.map((value) => ({ value, label: ATTEMPT_FILTER_LABELS[value] })),
            ]}
          />
        </div>
      </div>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading attempts…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No attempts"
          description={status ? 'Nothing matches this filter.' : 'Student attempts appear here.'}
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Attempts">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/faculty/attempts/${item.id}`}
                      className="rounded-sm font-medium text-heading hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {item.student.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">#{item.attemptNumber}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={item.status === 'IN_PROGRESS' ? 'info' : 'outline'}>
                        {ATTEMPT_STATUS_LABELS[item.status]}
                      </Badge>
                      {item.evaluationStatus === 'PENDING' ? (
                        <Badge variant="warning">Needs grading</Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.submittedAt ? `${formatDateTime(item.submittedAt)} IST` : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.result
                      ? `${formatScore(item.result.score, item.result.maxScore)} (${item.result.percent}%)`
                      : '—'}
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
              label="Attempt pages"
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
