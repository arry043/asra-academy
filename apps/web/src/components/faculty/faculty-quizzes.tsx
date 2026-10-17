'use client';

import type {
  AnswerReveal,
  CurriculumTreeDto,
  FacultyQuizDetail,
  FacultyQuizItem,
  Paginated,
} from '@asra/types';
import {
  ANSWER_REVEALS,
  QUIZ_DEFAULT_RULES,
  quizCreateSchema,
  quizSettingsSchema,
  type QuizSettingsInput,
} from '@asra/validation';
import { FileQuestion, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ANSWER_REVEAL_LABELS, formatMarksValue } from '@/lib/assessments';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { formatDateTime } from '@/lib/format';
import { facultyCourseHref } from '@/lib/faculty/portal';

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
  StatusBadge,
  errorMessage,
  useApiResource,
  useFacultyApi,
  withQuery,
} from './faculty-ui';

/**
 * Faculty quizzes (PHASE 09). A quiz is the online part of a QUIZ lesson: the lesson (title,
 * instructions, lesson publication) is edited in the curriculum; this workspace holds the rules,
 * the questions, the quiz lifecycle and the attempts.
 */

const home = { label: 'Dashboard', href: '/faculty/dashboard' };
const quizzesCrumb = { label: 'Quizzes', href: '/faculty/quizzes' };

export function QuizzesPage() {
  const api = useFacultyApi();
  const [page, setPage] = React.useState(1);
  const [course, setCourse] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const path = withQuery('/faculty/quizzes', { page, pageSize: 20, courseId: course });
  const list = useApiResource(path, () => api.get<Paginated<FacultyQuizItem>>(path));
  return (
    <>
      <PageHeader
        title="Quizzes"
        breadcrumbs={[home, { label: 'Quizzes' }]}
        description="Quiz lessons of your courses with their online quiz: multiple-choice, true/false and multiple-answer questions, scored by the server."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New quiz
          </Button>
        }
      />
      <div className="w-full max-w-sm">
        <CourseFilter
          id="quizzes-course"
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
        <LoadingPanel label="Loading quizzes…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<FileQuestion />}
          title="No quizzes yet"
          description="Create a quiz in one of your course chapters, or add a lesson of type Quiz in the curriculum and set up its online quiz."
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel="Quizzes">
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                <TableHead>Lesson</TableHead>
                <TableHead>Quiz status</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.lessonId}>
                  <TableCell>
                    <Link
                      href={`/faculty/quizzes/${item.lessonId}`}
                      className="grid rounded-sm hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="font-medium text-heading hover:underline">{item.title}</span>
                      <span className="type-caption text-muted-foreground">
                        {item.course.title} · {item.module.title} › {item.chapter.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.lessonStatus} />
                  </TableCell>
                  <TableCell>
                    {item.quiz ? (
                      <AssessmentStatusBadge status={item.quiz.status} />
                    ) : (
                      <Badge variant="warning">Not set up</Badge>
                    )}
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
              label="Quiz pages"
            />
          ) : null}
        </div>
      )}
      {creating ? <CreateQuizDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function CreateQuizDialog({ onClose }: { onClose: () => void }) {
  const api = useFacultyApi();
  const router = useRouter();
  const [courseId, setCourseId] = React.useState('');
  const [chapterId, setChapterId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const treePath = courseId ? `/faculty/courses/${courseId}/curriculum` : null;
  const tree = useApiResource(treePath, () => api.get<CurriculumTreeDto>(treePath!));
  const chapters =
    tree.data?.modules.flatMap((m) =>
      m.chapters.map((c) => ({ value: c.id, label: `${m.title} › ${c.title}` })),
    ) ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(quizCreateSchema, { title, instructions, ...QUIZ_DEFAULT_RULES });
    const local: FieldErrors = { ...(parsed.errors ?? {}) };
    if (!chapterId) local.chapterId = 'Choose the chapter this quiz belongs to';
    setFormError(null);
    if (Object.keys(local).length > 0 || !parsed.data) return setErrors(local);
    setErrors({});
    setPending(true);
    try {
      const created = await api.post<FacultyQuizDetail>(
        `/faculty/chapters/${chapterId}/quizzes`,
        parsed.data,
      );
      toast.success('Quiz created as a draft', {
        description: 'Add questions, then publish the lesson and the quiz.',
      });
      router.push(`/faculty/quizzes/${created.lessonId}`);
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New quiz</DialogTitle>
          <DialogDescription>
            Creates a draft quiz lesson in the chosen chapter. You set the rules and questions next.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <CourseFilter
              id="quiz-course"
              value={courseId}
              allLabel={null}
              onChange={(value) => {
                setCourseId(value);
                setChapterId('');
              }}
            />
            <SelectField
              id="quiz-chapter"
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
          <Field id="quiz-title" label="Title" error={errors.title}>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field
            id="quiz-instructions"
            label="Instructions"
            optional
            error={errors.instructions}
            hint="Shown to students before they start (plain text). Required before the lesson can be published."
          >
            <Textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Creating…">
              Create quiz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Workspace ------------------------------------------------------------------------------

export function QuizWorkspace({ lessonId }: { lessonId: string }) {
  const api = useFacultyApi();
  const path = `/faculty/quizzes/${lessonId}`;
  const detail = useApiResource(path, () => api.get<FacultyQuizDetail>(path));
  const [publishingResults, setPublishingResults] = React.useState(false);

  if (detail.error && !detail.data) {
    const denied = detail.error instanceof ApiClientError && detail.error.status === 403;
    return (
      <>
        <PageHeader title="Quiz" breadcrumbs={[home, quizzesCrumb, { label: 'Error' }]} />
        <ErrorPanel
          title={denied ? 'No access' : undefined}
          message={errorMessage(detail.error)}
          onRetry={denied ? undefined : detail.reload}
        />
      </>
    );
  }
  if (!detail.data) return <LoadingPanel label="Loading quiz…" rows={6} />;
  const data = detail.data;
  const quiz = data.quiz;
  const editable = !quiz || quiz.status === 'DRAFT';

  return (
    <>
      <PageHeader
        title={data.title}
        breadcrumbs={[home, quizzesCrumb, { label: data.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="type-caption">Lesson</span>
            <StatusBadge status={data.lessonStatus} />
            <span className="type-caption">Quiz</span>
            {quiz ? (
              <AssessmentStatusBadge status={quiz.status} />
            ) : (
              <Badge variant="warning">Not set up</Badge>
            )}
            <span>
              {data.course.title} · {data.module.title} › {data.chapter.title}
            </span>
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={facultyCourseHref(data.course.id, 'curriculum')}>
                Edit lesson & instructions
              </Link>
            </Button>
            {quiz ? (
              <TransitionButtons<FacultyQuizDetail>
                status={quiz.status}
                attempts={data.attempts.total}
                path={`/faculty/quizzes/${lessonId}/status`}
                closeNote="Attempts still running end now and are submitted with their saved answers."
                onDone={detail.replace}
              />
            ) : null}
          </span>
        }
      />
      {quiz && quiz.status !== 'DRAFT' && data.lessonStatus !== 'PUBLISHED' ? (
        <Alert tone="warning">
          <p>
            The quiz is open, but its lesson is a draft, so students cannot see it yet. Publish the
            lesson in the curriculum.
          </p>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="grid gap-6">
          <section aria-labelledby="instructions-heading" className="grid gap-2">
            <h2 id="instructions-heading" className="type-h3 text-heading">
              Instructions
            </h2>
            <div className="rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
              {data.instructions || (
                <span className="text-muted-foreground">No instructions written yet.</span>
              )}
            </div>
          </section>
          {quiz ? (
            <QuestionEditor
              kind="QUIZ"
              questions={data.questions}
              editable={editable}
              addPath={`/faculty/quizzes/${lessonId}/questions`}
              orderPath={`/faculty/quizzes/${lessonId}/question-order`}
              onChanged={detail.reload}
            />
          ) : null}
        </div>
        <div className="grid gap-4">
          <QuizRulesForm
            key={quiz?.updatedAt ?? 'new'}
            detail={data}
            editable={editable}
            onSaved={detail.replace}
          />
          {quiz && quiz.status !== 'DRAFT' ? (
            <div className="grid gap-2 rounded-xl border bg-card p-5">
              <h2 className="type-h4 text-heading">Results</h2>
              {quiz.showResultImmediately ? (
                <p className="type-body-sm text-muted-foreground">
                  Students see their score as soon as they submit.
                </p>
              ) : quiz.resultsPublishedAt ? (
                <p className="type-body-sm text-muted-foreground">
                  Published {formatDateTime(quiz.resultsPublishedAt)} IST.
                </p>
              ) : (
                <>
                  <p className="type-body-sm text-muted-foreground">
                    Scores are hidden from students until you publish them.
                  </p>
                  <Button variant="outline" onClick={() => setPublishingResults(true)}>
                    Publish results
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {quiz ? <AttemptsTable path={`/faculty/quizzes/${lessonId}/attempts`} /> : null}
      <ConfirmDialog
        open={publishingResults}
        onOpenChange={setPublishingResults}
        title="Publish quiz results?"
        description="Students will see the scores of their submitted attempts (and of later attempts). This cannot be undone."
        confirmLabel="Publish results"
        pendingLabel="Publishing…"
        onConfirm={async () => {
          try {
            detail.replace(
              await api.post<FacultyQuizDetail>(`/faculty/quizzes/${lessonId}/publish-results`),
            );
            toast.success('Results published');
          } catch (error) {
            toast.error('Could not publish results', { description: errorMessage(error) });
            throw error;
          }
        }}
      />
    </>
  );
}

const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function QuizRulesForm({
  detail,
  editable,
  onSaved,
}: {
  detail: FacultyQuizDetail;
  editable: boolean;
  onSaved: (data: FacultyQuizDetail) => void;
}) {
  const api = useFacultyApi();
  const initial: QuizSettingsInput = detail.quiz ?? QUIZ_DEFAULT_RULES;
  const [timeLimit, setTimeLimit] = React.useState(initial.timeLimitMinutes?.toString() ?? '');
  const [maxAttempts, setMaxAttempts] = React.useState(String(initial.maxAttempts));
  const [passPercent, setPassPercent] = React.useState(String(initial.passPercent));
  const [perAttempt, setPerAttempt] = React.useState(initial.questionsPerAttempt?.toString() ?? '');
  const [negativeMarking, setNegativeMarking] = React.useState(initial.negativeMarking);
  const [shuffleQuestions, setShuffleQuestions] = React.useState(initial.shuffleQuestions);
  const [shuffleOptions, setShuffleOptions] = React.useState(initial.shuffleOptions);
  const [showResultImmediately, setShowResultImmediately] = React.useState(
    initial.showResultImmediately,
  );
  const [answerReveal, setAnswerReveal] = React.useState<AnswerReveal>(initial.answerReveal);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const touch =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setDirty(true);
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !editable) return;
    const parsed = validateForm(quizSettingsSchema, {
      timeLimitMinutes: intOrNull(timeLimit),
      maxAttempts: Number(maxAttempts),
      passPercent: Number(passPercent),
      negativeMarking,
      shuffleQuestions,
      shuffleOptions,
      questionsPerAttempt: intOrNull(perAttempt),
      showResultImmediately,
      answerReveal,
    });
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const saved = await api.put<FacultyQuizDetail>(
        `/faculty/lessons/${detail.lessonId}/quiz`,
        parsed.data,
      );
      toast.success(detail.quiz ? 'Quiz rules saved' : 'Online quiz set up');
      setDirty(false);
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
      aria-labelledby="rules-heading"
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="rules-heading" className="type-h4 text-heading">
        Quiz rules
      </h2>
      {!detail.quiz ? (
        <Alert tone="warning">
          <p>This quiz lesson has no online quiz yet. Save the rules to set it up.</p>
        </Alert>
      ) : !editable ? (
        <p className="type-caption text-muted-foreground">
          Rules are fixed while the quiz is open to students.
        </p>
      ) : null}
      {formError ? (
        <Alert tone="error">
          <p>{formError}</p>
        </Alert>
      ) : null}
      <fieldset disabled={!editable} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="rules-time"
            label="Time limit (minutes)"
            optional
            error={errors.timeLimitMinutes}
            hint="Empty = untimed."
          >
            <Input
              type="number"
              min={1}
              max={300}
              inputMode="numeric"
              value={timeLimit}
              onChange={(e) => touch(setTimeLimit)(e.target.value)}
            />
          </Field>
          <Field id="rules-attempts" label="Attempts per student" error={errors.maxAttempts}>
            <Input
              type="number"
              min={1}
              max={20}
              inputMode="numeric"
              value={maxAttempts}
              onChange={(e) => touch(setMaxAttempts)(e.target.value)}
            />
          </Field>
          <Field
            id="rules-pass"
            label="Pass mark (%)"
            error={errors.passPercent}
            hint="Reaching it exactly passes."
          >
            <Input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={passPercent}
              onChange={(e) => touch(setPassPercent)(e.target.value)}
            />
          </Field>
          <Field
            id="rules-subset"
            label="Questions per attempt"
            optional
            error={errors.questionsPerAttempt}
            hint="Empty = all. Otherwise a random subset per attempt."
          >
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={perAttempt}
              onChange={(e) => touch(setPerAttempt)(e.target.value)}
            />
          </Field>
        </div>
        <CheckboxField
          id="rules-negative"
          label="Negative marking"
          checked={negativeMarking}
          onChange={touch(setNegativeMarking)}
          hint="Deducts each question's negative marks for a wrong answer. Totals never go below 0."
        />
        <CheckboxField
          id="rules-shuffle-q"
          label="Shuffle question order"
          checked={shuffleQuestions}
          onChange={touch(setShuffleQuestions)}
        />
        <CheckboxField
          id="rules-shuffle-o"
          label="Shuffle answer options"
          checked={shuffleOptions}
          onChange={touch(setShuffleOptions)}
          hint="True/False options keep their order."
        />
        <CheckboxField
          id="rules-instant"
          label="Show the score as soon as the student submits"
          checked={showResultImmediately}
          onChange={touch(setShowResultImmediately)}
          hint="Off: scores stay hidden until you publish results."
        />
        <SelectField
          id="rules-reveal"
          label="Show correct answers"
          value={answerReveal}
          onValueChange={(value) => touch(setAnswerReveal)(value as AnswerReveal)}
          options={ANSWER_REVEALS.map((value) => ({ value, label: ANSWER_REVEAL_LABELS[value] }))}
          error={errors.answerReveal}
        />
      </fieldset>
      {editable ? (
        <Button type="submit" loading={pending} loadingText="Saving…">
          {detail.quiz ? 'Save rules' : 'Set up online quiz'}
        </Button>
      ) : null}
      {dirty && editable ? (
        <p className="type-caption text-warning">You have unsaved changes.</p>
      ) : null}
    </form>
  );
}
