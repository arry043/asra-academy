'use client';

import type {
  AttemptStartDto,
  Paginated,
  StudentAssessmentResultItem,
  StudentAttemptSummary,
  StudentExamDetail,
  StudentExamItem,
  StudentQuizDto,
} from '@asra/types';
import { CalendarClock, ClipboardList, FileQuestion, PlayCircle, Timer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ConfirmDialog } from '@/components/admin/admin-ui';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { ApiClientError } from '@/lib/api';
import {
  ANSWER_REVEAL_LABELS,
  ATTEMPT_STATUS_LABELS,
  EXAM_AVAILABILITY_LABELS,
  formatMarksValue,
  plural,
  RESULT_STATE_BADGE,
  RESULT_STATE_LABELS,
  scoreSummary,
} from '@/lib/assessments';
import { formatDateTime } from '@/lib/format';
import { learnHref } from '@/lib/student/learning';

import { ErrorPanel, ListPager, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi, withPage } from './use-student';

/**
 * Student side of quizzes and examinations (PHASE 09). Every state shown here comes from the API;
 * whether an attempt may start is decided by the server (`cannotStartReason`) and re-checked when
 * the start request arrives.
 */

const home = { label: 'Dashboard', href: '/student/dashboard' };

export const attemptHref = (attemptId: string) =>
  `/student/attempts/${encodeURIComponent(attemptId)}`;

function AttemptRows({ attempts }: { attempts: StudentAttemptSummary[] }) {
  if (attempts.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {attempts.map((attempt) => (
        <li key={attempt.id}>
          <Link
            href={attemptHref(attempt.id)}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 hover:bg-secondary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid">
              <span className="type-label text-heading">Attempt {attempt.attemptNumber}</span>
              <span className="type-caption text-muted-foreground">
                {ATTEMPT_STATUS_LABELS[attempt.status]}
                {attempt.submittedAt ? ` · ${formatDateTime(attempt.submittedAt)} IST` : ''}
              </span>
            </span>
            {attempt.result ? (
              <Badge
                variant={attempt.result.passed ? 'success' : 'warning'}
                className="tabular-nums"
              >
                {scoreSummary(attempt.result)}
              </Badge>
            ) : (
              <Badge variant={RESULT_STATE_BADGE[attempt.resultState]}>
                {RESULT_STATE_LABELS[attempt.resultState]}
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Starts (or resumes) an attempt and opens it. Double clicks are ignored; the API is idempotent. */
function useStartAttempt(path: string) {
  const api = useStudentApi();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const start = React.useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const started = await api.post<AttemptStartDto>(path);
      if (started.resumed) toast.info('Resuming your attempt in progress');
      router.push(attemptHref(started.attempt.id));
    } catch (error) {
      setPending(false);
      toast.error('Could not start', { description: errorMessage(error) });
      throw error;
    }
  }, [api, path, pending, router]);
  return { start, pending };
}

// --- Quiz panel (inside a QUIZ lesson) ------------------------------------------------------

export function QuizPanel({ lessonId }: { lessonId: string }) {
  const api = useStudentApi();
  const path = `/student/lessons/${lessonId}/quiz`;
  const quiz = useApiResource(path, () => api.get<StudentQuizDto>(path));
  const { start, pending } = useStartAttempt(`/student/lessons/${lessonId}/quiz/attempts`);
  const [confirming, setConfirming] = React.useState(false);

  if (quiz.error && !quiz.data)
    return <ErrorPanel message={errorMessage(quiz.error)} onRetry={quiz.reload} />;
  if (!quiz.data) return <LoadingPanel label="Loading quiz…" rows={2} />;
  const data = quiz.data;
  const rules = data.rules;

  return (
    <section aria-labelledby="quiz-heading" className="grid gap-3">
      <h2 id="quiz-heading" className="type-h3 text-heading">
        Online quiz
      </h2>
      {!data.available || !rules ? (
        <Alert tone="info">
          <p>
            The online quiz for this lesson is not open yet. Follow your faculty’s instructions.
          </p>
        </Alert>
      ) : (
        <div className="grid gap-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{plural(rules.questionsPerAttempt, 'question')}</Badge>
            <Badge variant="outline">
              {rules.timeLimitMinutes
                ? `${rules.timeLimitMinutes} min time limit`
                : 'No time limit'}
            </Badge>
            <Badge variant="outline">
              {data.attemptsUsed} of {rules.maxAttempts} attempts used
            </Badge>
            <Badge variant="outline">Pass mark {rules.passPercent}%</Badge>
            {rules.negativeMarking ? <Badge variant="warning">Negative marking</Badge> : null}
          </div>
          <p className="type-body-sm text-muted-foreground">
            {rules.showResultImmediately
              ? 'Your score is shown as soon as you submit.'
              : 'Your score appears once your faculty publish the results.'}{' '}
            Correct answers: {ANSWER_REVEAL_LABELS[rules.answerReveal].toLowerCase()}.
          </p>
          {data.inProgressAttemptId ? (
            <Button asChild className="w-fit">
              <Link href={attemptHref(data.inProgressAttemptId)}>
                <PlayCircle aria-hidden /> Continue your attempt
              </Link>
            </Button>
          ) : data.cannotStartReason ? (
            <Alert tone="info">
              <p>{data.cannotStartReason}</p>
            </Alert>
          ) : (
            <Button
              className="w-fit"
              onClick={() => setConfirming(true)}
              loading={pending}
              loadingText="Starting…"
            >
              <PlayCircle aria-hidden /> Start attempt {data.attemptsUsed + 1}
            </Button>
          )}
          <AttemptRows attempts={data.attempts} />
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Start the quiz?"
        description={
          rules?.timeLimitMinutes
            ? `You will have ${rules.timeLimitMinutes} minutes. The timer runs on the server from now, even if you close the page.`
            : 'Your answers are saved as you go. Submit when you are done.'
        }
        confirmLabel="Start"
        pendingLabel="Starting…"
        onConfirm={start}
      />
    </section>
  );
}

// --- Examinations ---------------------------------------------------------------------------

function ExamCard({ exam }: { exam: StudentExamItem }) {
  return (
    <Card className="gap-3 sm:flex-row sm:items-center">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="type-caption text-muted-foreground">{exam.course.title}</span>
        <h2 className="type-h4 break-words text-heading">
          <Link
            href={`/student/exams/${exam.id}`}
            className="rounded-sm hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {exam.title}
          </Link>
        </h2>
        <span className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              exam.availability === 'OPEN'
                ? 'success'
                : exam.availability === 'UPCOMING'
                  ? 'info'
                  : 'secondary'
            }
          >
            {EXAM_AVAILABILITY_LABELS[exam.availability]}
          </Badge>
          <span className="type-body-sm text-muted-foreground">
            {formatDateTime(exam.opensAt)} – {formatDateTime(exam.closesAt)} IST ·{' '}
            {exam.durationMinutes} min
          </span>
          {exam.inProgressAttemptId ? <Badge variant="warning">Attempt in progress</Badge> : null}
          {exam.resultsPublished ? <Badge variant="success">Results published</Badge> : null}
        </span>
      </div>
      <Button asChild size="sm" variant="outline" className="self-start sm:self-center">
        <Link href={`/student/exams/${exam.id}`}>Details</Link>
      </Button>
    </Card>
  );
}

export function StudentExamsPage() {
  const api = useStudentApi();
  const [when, setWhen] = React.useState<'current' | 'past'>('current');
  const [page, setPage] = React.useState(1);
  const url = withPage('/student/exams', page, { when });
  const list = useApiResource(url, () => api.get<Paginated<StudentExamItem>>(url));
  return (
    <>
      <PageHeader
        title="Exams"
        breadcrumbs={[home, { label: 'Exams' }]}
        description="Scheduled examinations of your courses. Times are in IST and are kept by the server."
      />
      <Tabs
        value={when}
        onValueChange={(value) => {
          setWhen(value as 'current' | 'past');
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="current">Upcoming and open</TabsTrigger>
          <TabsTrigger value="past">Closed</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.error && !list.data ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label="Loading exams…" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={when === 'current' ? 'No upcoming exams' : 'No closed exams'}
          description="Examinations scheduled by your faculty for your courses appear here."
        />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <ul className="grid gap-3">
            {list.data.items.map((exam) => (
              <li key={exam.id}>
                <ExamCard exam={exam} />
              </li>
            ))}
          </ul>
          <ListPager pagination={list.data.pagination} onPageChange={setPage} label="Exam pages" />
        </div>
      )}
    </>
  );
}

export function StudentExamDetailPage({ examId }: { examId: string }) {
  const api = useStudentApi();
  const path = `/student/exams/${examId}`;
  const exam = useApiResource(path, () => api.get<StudentExamDetail>(path));
  const { start, pending } = useStartAttempt(`/student/exams/${examId}/attempts`);
  const [confirming, setConfirming] = React.useState(false);
  const examsCrumb = { label: 'Exams', href: '/student/exams' };

  if (exam.error && !exam.data) {
    const missing = exam.error instanceof ApiClientError && [403, 404].includes(exam.error.status);
    return (
      <>
        <PageHeader title="Exam" breadcrumbs={[home, examsCrumb, { label: 'Not available' }]} />
        <ErrorPanel
          title={missing ? 'Exam not available' : undefined}
          message={errorMessage(exam.error)}
          onRetry={missing ? undefined : exam.reload}
        />
      </>
    );
  }
  if (!exam.data) return <LoadingPanel label="Loading exam…" rows={5} />;
  const data = exam.data;

  return (
    <>
      <PageHeader
        title={data.title}
        breadcrumbs={[home, examsCrumb, { label: data.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={data.availability === 'OPEN' ? 'success' : 'secondary'}>
              {EXAM_AVAILABILITY_LABELS[data.availability]}
            </Badge>
            <span>{data.course.title}</span>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="instructions-heading" className="grid gap-3">
          <h2 id="instructions-heading" className="type-h3 text-heading">
            Instructions
          </h2>
          <div className="rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
            {data.instructions || (
              <span className="text-muted-foreground">No special instructions.</span>
            )}
          </div>
          <Alert tone="info" title="How timing works">
            <p>
              Your {data.durationMinutes}-minute timer starts on the server when you press Start and
              keeps running if you close the page or lose your connection. If the exam closes
              earlier, your time ends when it closes. Answers are saved as you go; when time is up,
              the answers the server received are submitted automatically.
            </p>
          </Alert>
          <section aria-labelledby="attempts-heading" className="grid gap-2">
            <h2 id="attempts-heading" className="type-h4 text-heading">
              Your attempts
            </h2>
            {data.attempts.length === 0 ? (
              <p className="type-body-sm text-muted-foreground">
                You have not attempted this exam.
              </p>
            ) : (
              <AttemptRows attempts={data.attempts} />
            )}
          </section>
        </section>
        <aside className="grid gap-4 rounded-xl border bg-card p-5 shadow-card">
          <dl className="grid gap-2 type-body-sm">
            <Fact
              icon={<CalendarClock />}
              label="Opens"
              value={`${formatDateTime(data.opensAt)} IST`}
            />
            <Fact
              icon={<CalendarClock />}
              label="Closes"
              value={`${formatDateTime(data.closesAt)} IST`}
            />
            <Fact icon={<Timer />} label="Duration" value={`${data.durationMinutes} minutes`} />
            <Fact
              icon={<FileQuestion />}
              label="Questions"
              value={`${data.questionCount} · ${formatMarksValue(data.maxScore)} marks`}
            />
            <Fact
              icon={<ClipboardList />}
              label="Attempts"
              value={`${data.attemptsUsed} of ${data.maxAttempts} used`}
            />
          </dl>
          <p className="type-caption text-muted-foreground">
            Pass mark {data.passPercent}%{data.negativeMarking ? ' · wrong answers lose marks' : ''}
            {data.hasWrittenQuestions ? ' · written answers are graded by your faculty' : ''}.
          </p>
          {data.inProgressAttemptId ? (
            <Button asChild>
              <Link href={attemptHref(data.inProgressAttemptId)}>
                <PlayCircle aria-hidden /> Continue your attempt
              </Link>
            </Button>
          ) : data.cannotStartReason ? (
            <Alert tone="info">
              <p>{data.cannotStartReason}</p>
            </Alert>
          ) : (
            <Button onClick={() => setConfirming(true)} loading={pending} loadingText="Starting…">
              <PlayCircle aria-hidden /> Start the exam
            </Button>
          )}
          {data.resultsPublished ? null : data.attempts.length > 0 ? (
            <p className="type-caption text-muted-foreground">
              Results appear after your faculty publish them.
            </p>
          ) : null}
        </aside>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Start the exam now?"
        description={`Your ${data.durationMinutes}-minute timer starts on the server as soon as you confirm and cannot be paused.`}
        confirmLabel="Start the exam"
        pendingLabel="Starting…"
        onConfirm={async () => {
          try {
            await start();
          } catch (error) {
            exam.reload();
            throw error;
          }
        }}
      />
    </>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden className="mt-0.5 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="text-muted-foreground">{label}: </span>
        {value}
      </dd>
    </div>
  );
}

// --- Results --------------------------------------------------------------------------------

/** Released quiz and exam results (the API applies the release rules). */
export function AssessmentResults() {
  const api = useStudentApi();
  const [page, setPage] = React.useState(1);
  const url = withPage('/student/assessment-results', page);
  const list = useApiResource(url, () => api.get<Paginated<StudentAssessmentResultItem>>(url));
  if (list.error && !list.data)
    return <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />;
  if (!list.data) return <LoadingPanel label="Loading quiz and exam results…" rows={2} />;
  if (list.data.items.length === 0) {
    return (
      <p className="type-body-sm text-muted-foreground">
        No quiz or exam results yet. Results appear here once they are released.
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {list.data.items.map((item) => (
          <li key={item.attemptId}>
            <Card className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <span className="type-caption text-muted-foreground">
                  {item.kind === 'EXAM' ? 'Exam' : 'Quiz'} · {item.course.title} · attempt{' '}
                  {item.attemptNumber} · {formatDateTime(item.submittedAt)} IST
                </span>
                <h3 className="type-h4 text-heading">
                  <Link
                    href={attemptHref(item.attemptId)}
                    className="rounded-sm hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.title}
                  </Link>
                </h3>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.result.passed ? 'success' : 'warning'}
                  className="tabular-nums"
                >
                  {scoreSummary(item.result)}
                </Badge>
                {item.kind === 'QUIZ' && item.lessonId ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={learnHref(item.course.id, item.lessonId)}>Lesson</Link>
                  </Button>
                ) : null}
              </span>
            </Card>
          </li>
        ))}
      </ul>
      <ListPager pagination={list.data.pagination} onPageChange={setPage} label="Result pages" />
    </div>
  );
}
