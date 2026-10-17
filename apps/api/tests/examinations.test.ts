/**
 * PHASE 09 — Examinations: server-controlled timing and integrity (docs/ASSESSMENTS.md §7).
 *
 * The server clock is pinned with `at()` (lib/clock), so every timing rule is tested at exact
 * instants without real-time sleeps. Numbered comments map to the mandatory scenarios 1–21 of
 * the Phase 09 brief.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  AttemptStartDto,
  FacultyAttemptDetail,
  FacultyAttemptItem,
  FacultyExamDetail,
  Paginated,
  StudentAssessmentResultItem,
  StudentAttemptDto,
  StudentExamDetail,
  StudentExamItem,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setClockForTests } from '../src/lib/clock.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { sweepExpiredAttempts } from '../src/modules/assessments/attempts.core.js';
import {
  answer,
  at,
  buildWorld,
  createExam,
  mcq,
  multi,
  plusMinutes,
  signInAgain,
  startExam,
  trueFalse,
  written,
  type World,
} from './support/assessment.js';
import { expectStatus } from './support/catalog.js';
import { startServer } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
let w: World;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  setClockForTests(null);
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});

/** Window used by most tests: opens 10:00 IST (04:30Z), closes 12:00 IST, 60-minute attempts. */
const OPENS = new Date('2026-11-02T04:30:00.000Z');
const CLOSES = new Date('2026-11-02T06:30:00.000Z');
const BEFORE = new Date('2026-11-01T12:00:00.000Z');

beforeEach(async () => {
  w = await buildWorld(baseUrl);
  at(BEFORE); // faculty prepare the exam the day before
});

async function publishedExam(options: Parameters<typeof createExam>[3] = {}) {
  return createExam(w.alice, w.courseA.courseId, { opensAt: OPENS, closesAt: CLOSES }, options);
}

async function submit(student: World['sam'], attemptId: string) {
  const response = await student.api<StudentAttemptDto>(
    'POST',
    `/student/attempts/${attemptId}/submit`,
  );
  expectStatus(response, 200);
  return response;
}

describe('starting an examination (server availability window)', () => {
  it('1–3: refuses before opening and after closing; starts while available', async () => {
    const { examId } = await publishedExam();
    at(plusMinutes(OPENS, -1)); // 1. before opening
    const early = await w.sam.api('POST', `/student/exams/${examId}/attempts`);
    expectStatus(early, 409);
    assert.match(early.body.message, /not opened yet/);

    at(CLOSES); // 3. at/after closing
    expectStatus(await w.sam.api('POST', `/student/exams/${examId}/attempts`), 409);
    at(plusMinutes(CLOSES, 30));
    expectStatus(await w.sam.api('POST', `/student/exams/${examId}/attempts`), 409);

    const now = at(plusMinutes(OPENS, 5)); // 2. while available
    const started = await startExam(w.sam, examId);
    assert.equal(started.resumed, false);
    assert.equal(started.attempt.startedAt, now.toISOString(), 'server time, not browser time');
    assert.equal(started.attempt.serverNow, now.toISOString());
  });

  it('4–5: deadline = start + duration, capped at the closing time; no start in the last minute', async () => {
    const { examId } = await publishedExam({ durationMinutes: 60 });
    const t1 = at(plusMinutes(OPENS, 10));
    const first = await startExam(w.sam, examId);
    assert.equal(first.attempt.deadlineAt, plusMinutes(t1, 60).toISOString()); // 4.

    const t2 = at(plusMinutes(CLOSES, -20)); // 5. only 20 minutes left in the window
    const second = await startExam(w.una, examId);
    assert.equal(second.attempt.deadlineAt, CLOSES.toISOString());
    assert.ok(new Date(second.attempt.deadlineAt!) < plusMinutes(t2, 60));

    at(new Date(CLOSES.getTime() - 59_000)); // less than a minute left
    const tooLate = await w.sam.api('POST', `/student/exams/${examId}/attempts`);
    expectStatus(tooLate, 409);
  });

  it('8–9: ignores the browser clock and rejects client-supplied times', async () => {
    const { examId } = await publishedExam();
    // 9. A start time / deadline in the body is a validation error (strict body).
    at(plusMinutes(OPENS, 1));
    expectStatus(
      await w.sam.api('POST', `/student/exams/${examId}/attempts`, {
        startedAt: plusMinutes(OPENS, 50).toISOString(),
        deadlineAt: plusMinutes(CLOSES, 600).toISOString(),
      }),
      422,
    );
    // 8. The device clock (sent as headers by some clients) has no influence on acceptance.
    const now = at(plusMinutes(OPENS, 2));
    const started = await w.sam.api<AttemptStartDto>(
      'POST',
      `/student/exams/${examId}/attempts`,
      undefined,
    );
    expectStatus(started, 201);
    const attempt = started.body.data.attempt;
    assert.equal(attempt.deadlineAt, plusMinutes(now, 60).toISOString());
    at(plusMinutes(now, 61)); // server: deadline passed — even though the "browser" may think otherwise
    const q = attempt.questions[0]!;
    const save = await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
      selectedOptionIds: [q.options[0]!.id],
      sequence: 1,
    });
    expectStatus(save, 409);
    // Remaining time / deadline fields cannot be posted with an answer either.
    expectStatus(
      await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
        selectedOptionIds: [],
        sequence: 2,
        deadlineAt: plusMinutes(CLOSES, 60).toISOString(),
      }),
      422,
    );
  });

  it('10: refreshing or restarting returns the same attempt, questions and deadline', async () => {
    const { examId } = await publishedExam({
      extra: { shuffleQuestions: true, shuffleOptions: true },
    });
    at(plusMinutes(OPENS, 3));
    const started = await startExam(w.sam, examId);
    at(plusMinutes(OPENS, 20));
    const view = (attempt: StudentAttemptDto) =>
      attempt.questions.map((q) => [q.id, q.prompt, q.options.map((o) => o.id)]);
    for (let i = 0; i < 3; i++) {
      const refreshed = await w.sam.api<StudentAttemptDto>(
        'GET',
        `/student/attempts/${started.attempt.id}`,
      );
      assert.deepEqual(view(refreshed.body.data), view(started.attempt));
      assert.equal(refreshed.body.data.deadlineAt, started.attempt.deadlineAt);
    }
    const again = await startExam(w.sam, examId, 200);
    assert.equal(again.resumed, true);
    assert.equal(again.attempt.id, started.attempt.id);
    assert.equal(
      again.attempt.deadlineAt,
      started.attempt.deadlineAt,
      'resuming never extends time',
    );
    assert.deepEqual(view(again.attempt), view(started.attempt));
  });
});

describe('answers, submission and finalization', () => {
  it('6–7: rejects saves at/after the deadline; a late submit finalizes with in-time answers only', async () => {
    const { examId } = await publishedExam({ durationMinutes: 30 });
    const start = at(plusMinutes(OPENS, 0));
    const { attempt } = await startExam(w.sam, examId);
    const deadline = plusMinutes(start, 30);
    at(new Date(deadline.getTime() - 1)); // 1 ms before the deadline: accepted
    expectStatus(await answer(w.sam, attempt, 'What is 2 + 3?', ['5']), 200);
    at(deadline); // 6. exactly at the deadline: refused
    const late = await answer(w.sam, attempt, 'Which numbers are prime?', ['2', '3']);
    expectStatus(late, 409);
    assert.deepEqual(late.body.error?.details, { attemptStatus: 'EXPIRED' });
    at(plusMinutes(deadline, 2)); // 7. submit after the deadline
    const submitted = await submit(w.sam, attempt.id);
    assert.match(submitted.body.message, /already submitted|Time was up/);
    const final = submitted.body.data;
    assert.equal(final.status, 'EXPIRED');
    assert.equal(final.submittedAt, deadline.toISOString(), 'accepted time is the deadline');
    const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert.equal(Number(row.score), 4, 'only the MCQ answered in time counts');
  });

  it('11 & 21: attempts and results are private to their student', async () => {
    const { examId } = await publishedExam();
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    const q = attempt.questions[0]!;
    for (const other of [w.una, w.tara]) {
      expectStatus(await other.api('GET', `/student/attempts/${attempt.id}`), 404);
      expectStatus(
        await other.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
          selectedOptionIds: [q.options[0]!.id],
          sequence: 5,
        }),
        404,
      );
      expectStatus(await other.api('POST', `/student/attempts/${attempt.id}/submit`), 404);
    }
    await submit(w.sam, attempt.id);
    at(plusMinutes(CLOSES, 1));
    expectStatus(await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`), 200);
    const unaResults = await w.una.api<Paginated<StudentAssessmentResultItem>>(
      'GET',
      '/student/assessment-results',
    );
    assert.equal(unaResults.body.data.items.length, 0);
    expectStatus(await w.una.api('GET', `/student/attempts/${attempt.id}`), 404);
    // Tara is not enrolled in course A at all.
    expectStatus(await w.tara.api('GET', `/student/exams/${examId}`), 403);
  });

  it('12–13: concurrent starts create one attempt; the attempt limit holds under a race', async () => {
    const { examId } = await publishedExam({ maxAttempts: 2 });
    at(plusMinutes(OPENS, 1));
    const burst = await Promise.all(
      Array.from({ length: 8 }, () => w.sam.api('POST', `/student/exams/${examId}/attempts`)),
    );
    assert.ok(
      burst.every((r) => [200, 201, 409].includes(r.status)),
      burst.map((r) => r.status).join(),
    );
    assert.equal(burst.filter((r) => r.status === 201).length, 1, 'exactly one attempt created'); // 13.
    assert.equal(await prisma.assessmentAttempt.count({ where: { examinationId: examId } }), 1);
    const first = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { examinationId: examId },
    });
    await submit(w.sam, first.id);
    // 12. Racing for the last allowed attempt: only one wins.
    const race = await Promise.all(
      Array.from({ length: 8 }, () => w.sam.api('POST', `/student/exams/${examId}/attempts`)),
    );
    assert.equal(race.filter((r) => r.status === 201).length, 1);
    assert.equal(
      await prisma.assessmentAttempt.count({
        where: { examinationId: examId, userId: w.sam.userId },
      }),
      2,
    );
    const second = await prisma.assessmentAttempt.findFirstOrThrow({
      where: { examinationId: examId, attemptNumber: 2 },
    });
    await submit(w.sam, second.id);
    expectStatus(await w.sam.api('POST', `/student/exams/${examId}/attempts`), 409);
  });

  it('14–15: concurrent and repeated submissions finalize and evaluate exactly once', async () => {
    const { examId } = await publishedExam();
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        w.sam.api<StudentAttemptDto>('POST', `/student/attempts/${attempt.id}/submit`),
      ),
    );
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(results.filter((r) => r.body.message === 'Attempt submitted').length, 1);
    const submittedAt = new Set(results.map((r) => r.body.data.submittedAt));
    assert.equal(submittedAt.size, 1);
    // 15. Idempotent: sweeper + another submit + another sweep change nothing.
    at(plusMinutes(CLOSES, 5));
    await sweepExpiredAttempts();
    await submit(w.sam, attempt.id);
    await sweepExpiredAttempts();
    const audits = await prisma.assessmentAuditLog.count({
      where: { entityId: attempt.id, action: 'attempt.finalized' },
    });
    assert.equal(audits, 1);
    const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert.equal(Number(row.score), 4);
    assert.equal(row.status, 'SUBMITTED');
  });

  it('16: deadlines survive a restart and a delayed worker; late processing keeps the deadline as the submit time', async () => {
    const { examId } = await publishedExam({ durationMinutes: 45 });
    const start = at(plusMinutes(OPENS, 0));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    // "Restart": a brand-new app instance with no memory of the attempt; no worker ran meanwhile.
    const restarted = await startServer(createApp());
    try {
      const processedAt = at(plusMinutes(start, 45 + 90)); // 90 minutes after the deadline
      const sam = await signInAgain(restarted.baseUrl, w.sam);
      const save = await answer(sam, attempt, 'Which numbers are prime?', ['2', '3']);
      expectStatus(save, 409);
      const view = await sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
      assert.equal(view.body.data.status, 'EXPIRED');
      assert.equal(view.body.data.deadlineAt, plusMinutes(start, 45).toISOString());
      assert.equal(view.body.data.submittedAt, plusMinutes(start, 45).toISOString());
      const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      assert.equal(row.finalizedAt!.toISOString(), processedAt.toISOString());
      assert.equal(Number(row.score), 4);
    } finally {
      await restarted.close();
    }
  });

  it('17: the expiry sweep finalizes unattended attempts (and the faculty trigger reports them)', async () => {
    const { examId } = await publishedExam({ durationMinutes: 15 });
    at(plusMinutes(OPENS, 0));
    const sam = await startExam(w.sam, examId);
    const una = await startExam(w.una, examId);
    await answer(w.sam, sam.attempt, 'What is 2 + 3?', ['5']);
    at(plusMinutes(OPENS, 14));
    assert.equal(await sweepExpiredAttempts(), 0, 'nothing has expired yet');
    at(plusMinutes(OPENS, 16));
    assert.equal(await sweepExpiredAttempts(), 1 + 1);
    const rows = await prisma.assessmentAttempt.findMany({
      where: { examinationId: examId },
      orderBy: { userId: 'asc' },
    });
    assert.ok(rows.every((r) => r.status === 'EXPIRED' && r.evaluationStatus === 'EVALUATED'));
    assert.equal(Number(rows.find((r) => r.userId === w.sam.userId)!.score), 4);
    assert.equal(Number(rows.find((r) => r.id === una.attempt.id)!.score), 0);
    const processed = await w.alice.api<{ finalized: number }>(
      'POST',
      `/faculty/exams/${examId}/process-expired`,
    );
    expectStatus(processed, 200);
    assert.equal(processed.body.data.finalized, 0);
  });

  it('18: evaluates the persisted snapshot, not the current question bank or the request', async () => {
    const { examId, questions } = await publishedExam();
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    await answer(w.sam, attempt, 'Which numbers are prime?', ['2', '3']);
    // Someone changes the answer key in the database after the attempt started.
    await prisma.assessmentQuestionOption.updateMany({
      where: { questionId: questions[0]!.id },
      data: { isCorrect: false },
    });
    await prisma.assessmentQuestion.update({
      where: { id: questions[1]!.id },
      data: { marks: 99 },
    });
    const final = (await submit(w.sam, attempt.id)).body.data;
    const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: final.id } });
    assert.equal(Number(row.score), 7, 'MCQ 4 + multi 3 from the snapshot');
    assert.equal(Number(row.maxScore), 10);
  });

  it('19: answers cannot change after finalization', async () => {
    const { examId } = await publishedExam();
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['4']);
    await submit(w.sam, attempt.id);
    const change = await answer(w.sam, attempt, 'What is 2 + 3?', ['5'], 99);
    expectStatus(change, 409);
    assert.deepEqual(change.body.error?.details, { attemptStatus: 'SUBMITTED' });
    const stored = await prisma.attemptQuestion.findFirstOrThrow({
      where: { attemptId: attempt.id, position: 0 },
    });
    assert.equal(stored.answerSequence, 1);
    const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert.equal(Number(row.score), 0);
  });

  it('20: results stay private until faculty publish them after the window ends', async () => {
    const { examId } = await publishedExam();
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const final = (await submit(w.sam, attempt.id)).body.data;
    assert.equal(final.resultState, 'AWAITING_RELEASE');
    assert.equal(final.result, null);
    assert.equal(final.review, null);
    assert.ok(!JSON.stringify(final).includes('isCorrect'));
    const detail = await w.sam.api<StudentExamDetail>('GET', `/student/exams/${examId}`);
    assert.equal(detail.body.data.attempts[0]!.result, null);
    // Too early: the window is still open.
    expectStatus(await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`), 409);
    expectStatus(await w.bob.api('POST', `/faculty/exams/${examId}/publish-results`), 403);
    at(plusMinutes(CLOSES, 1));
    const published = await w.alice.api<FacultyExamDetail>(
      'POST',
      `/faculty/exams/${examId}/publish-results`,
    );
    expectStatus(published, 200);
    assert.ok(published.body.data.resultsPublishedAt);
    const visible = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.equal(visible.body.data.resultState, 'RELEASED');
    assert.deepEqual(visible.body.data.result, {
      rawScore: 4,
      penalty: 0,
      score: 4,
      maxScore: 10,
      percent: 40,
      passed: true,
    });
    assert.ok(visible.body.data.review, 'answers revealed after close (AFTER_CLOSE)');
    const results = await w.sam.api<Paginated<StudentAssessmentResultItem>>(
      'GET',
      '/student/assessment-results',
    );
    assert.equal(results.body.data.items[0]!.kind, 'EXAM');
    // Publishing again is idempotent.
    const again = await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`);
    assert.equal(again.body.message, 'Results were already published');
  });
});

describe('written answers and manual evaluation', () => {
  it('keeps the result pending until every written answer is graded, then publishes', async () => {
    const { examId } = await publishedExam({ questions: [mcq(4), written(6)] });
    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const essay = attempt.questions.find((q) => q.type === 'SHORT_ANSWER')!;
    expectStatus(
      await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${essay.id}`, {
        textAnswer: 'x = (−b ± √Δ) / 2a',
        sequence: 1,
      }),
      200,
    );
    expectStatus(
      await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${essay.id}`, {
        selectedOptionIds: [],
        sequence: 2,
      }),
      422,
    );
    const final = (await submit(w.sam, attempt.id)).body.data;
    assert.equal(final.resultState, 'PENDING_EVALUATION');
    at(plusMinutes(CLOSES, 1));
    const blocked = await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`);
    expectStatus(blocked, 409);
    assert.match(blocked.body.message, /awaiting grading/);

    const attempts = await w.alice.api<Paginated<FacultyAttemptItem>>(
      'GET',
      `/faculty/exams/${examId}/attempts?status=PENDING_EVALUATION`,
    );
    assert.equal(attempts.body.data.items.length, 1);
    const detail = await w.alice.api<FacultyAttemptDetail>(
      'GET',
      `/faculty/attempts/${attempt.id}`,
    );
    const essayAnswer = detail.body.data.questions.find((q) => q.type === 'SHORT_ANSWER')!;
    assert.equal(essayAnswer.textAnswer, 'x = (−b ± √Δ) / 2a');
    const grade = (marks: number, api = w.alice.api) =>
      api<FacultyAttemptDetail>('PUT', `/faculty/attempt-answers/${essayAnswer.id}/grade`, {
        awardedMarks: marks,
        feedback: 'Good',
      });
    expectStatus(await grade(7), 422);
    expectStatus(await grade(4, w.bob.api), 403);
    const mcqAnswer = detail.body.data.questions.find((q) => q.type === 'SINGLE_CHOICE')!;
    expectStatus(
      await w.alice.api('PUT', `/faculty/attempt-answers/${mcqAnswer.id}/grade`, {
        awardedMarks: 1,
      }),
      409,
    );
    const graded = await grade(4.5);
    expectStatus(graded, 200);
    const gradedDetail = graded.body.data;
    assert.equal(gradedDetail.evaluationStatus, 'EVALUATED');
    assert.equal(gradedDetail.result!.score, 8.5);
    // Re-grading before publication is allowed and audited.
    expectStatus(await grade(5), 200);
    expectStatus(await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`), 200);
    expectStatus(await grade(6), 409);
    const visible = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.equal(visible.body.data.result!.score, 9);
    const history = await prisma.assessmentAuditLog.count({
      where: { entityId: attempt.id, action: 'attempt.answer_graded' },
    });
    assert.equal(history, 2);
  });
});

describe('examination management', () => {
  it('validates the schedule and freezes a published exam', async () => {
    const path = `/faculty/courses/${w.courseA.courseId}/exams`;
    const base = {
      title: 'Unit test',
      opensAt: OPENS.toISOString(),
      closesAt: CLOSES.toISOString(),
      durationMinutes: 30,
      maxAttempts: 1,
      passPercent: 40,
      negativeMarking: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      answerReveal: 'NEVER',
    };
    expectStatus(await w.alice.api('POST', path, { ...base, closesAt: OPENS.toISOString() }), 422);
    expectStatus(await w.alice.api('POST', path, { ...base, durationMinutes: 0 }), 422);
    expectStatus(await w.alice.api('POST', path, { ...base, maxAttempts: 6 }), 422);
    expectStatus(await w.alice.api('POST', path, { ...base, status: 'PUBLISHED' }), 422);
    at(plusMinutes(CLOSES, 1));
    expectStatus(await w.alice.api('POST', path, base), 422); // closing time already passed
    at(BEFORE);
    expectStatus(await w.bob.api('POST', path, base), 403);
    const { examId } = await publishedExam();
    expectStatus(
      await w.alice.api('PATCH', `/faculty/exams/${examId}`, { durationMinutes: 90 }),
      409,
    );
    expectStatus(await w.alice.api('POST', `/faculty/exams/${examId}/questions`, trueFalse()), 409);
    expectStatus(await w.alice.api('DELETE', `/faculty/exams/${examId}`), 409);
    const draft = await createExam(
      w.alice,
      w.courseA.courseId,
      { opensAt: OPENS, closesAt: CLOSES },
      { publish: false, questions: [] },
    );
    expectStatus(
      await w.alice.api('POST', `/faculty/exams/${draft.examId}/status`, { action: 'publish' }),
      409,
    );
    expectStatus(
      await w.alice.api('PATCH', `/faculty/exams/${draft.examId}`, {
        closesAt: plusMinutes(OPENS, -1).toISOString(),
      }),
      422,
    );
    expectStatus(await w.alice.api('DELETE', `/faculty/exams/${draft.examId}`), 200);
    expectStatus(await w.bob.api('GET', `/faculty/exams/${examId}`), 403);
  });

  it('lists exams for enrolled students only, never drafts; closing stops new attempts', async () => {
    const { examId } = await publishedExam();
    const draft = await createExam(
      w.alice,
      w.courseA.courseId,
      { opensAt: OPENS, closesAt: CLOSES },
      { publish: false, questions: [multi()] },
    );
    const list = await w.sam.api<Paginated<StudentExamItem>>('GET', '/student/exams');
    assert.deepEqual(
      list.body.data.items.map((e) => e.id),
      [examId],
    );
    assert.equal(list.body.data.items[0]!.availability, 'UPCOMING');
    expectStatus(await w.sam.api('GET', `/student/exams/${draft.examId}`), 404);
    const tara = await w.tara.api<Paginated<StudentExamItem>>('GET', '/student/exams');
    assert.equal(tara.body.data.items.length, 0);
    at(plusMinutes(OPENS, 5));
    const { attempt } = await startExam(w.sam, examId);
    expectStatus(
      await w.alice.api('POST', `/faculty/exams/${examId}/status`, { action: 'close' }),
      200,
    );
    expectStatus(await w.una.api('POST', `/student/exams/${examId}/attempts`), 409);
    // A running attempt keeps its deadline after an early close.
    expectStatus(await answer(w.sam, attempt, 'What is 2 + 3?', ['5']), 200);
    const past = await w.sam.api<Paginated<StudentExamItem>>('GET', '/student/exams?when=past');
    assert.deepEqual(
      past.body.data.items.map((e) => e.id),
      [examId],
    );
  });
});
