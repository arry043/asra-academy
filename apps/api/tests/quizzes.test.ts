/**
 * PHASE 09 — Quizzes over HTTP with the real middleware and database: authoring, publication,
 * attempts, server-side scoring, attempt limits, randomisation persistence, answer-key
 * confidentiality, result release and authorization boundaries (docs/ASSESSMENTS.md §5).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  FacultyAttemptDetail,
  FacultyQuizDetail,
  Paginated,
  StudentAssessmentResultItem,
  StudentAttemptDto,
  StudentQuizDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setClockForTests } from '../src/lib/clock.js';
import { disconnectRedis } from '../src/lib/redis.js';
import {
  answer,
  at,
  buildWorld,
  createQuiz,
  mcq,
  multi,
  plusMinutes,
  startQuiz,
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
beforeEach(async () => {
  w = await buildWorld(baseUrl);
});

const T0 = '2026-11-02T04:30:00.000Z';

async function submit(student: World['sam'], attemptId: string, status = 200) {
  const response = await student.api<StudentAttemptDto>(
    'POST',
    `/student/attempts/${attemptId}/submit`,
  );
  expectStatus(response, status);
  return response.body.data;
}

describe('quiz authoring and lifecycle', () => {
  it('creates a quiz with all three objective question types and publishes it', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const detail = await w.alice.api<FacultyQuizDetail>('GET', `/faculty/quizzes/${quiz.lessonId}`);
    expectStatus(detail, 200);
    assert.equal(detail.body.data.quiz!.status, 'PUBLISHED');
    assert.deepEqual(
      detail.body.data.questions.map((q) => q.type),
      ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'],
    );
    assert.equal(detail.body.data.totalMarks, 6);
    const audit = await prisma.assessmentAuditLog.findMany({ where: { entityId: quiz.quizId } });
    assert.deepEqual(
      audit.map((a) => a.action),
      ['quiz.published'],
    );
  });

  it('validates rules and questions on the server', async () => {
    const chapter = `/faculty/chapters/${w.courseA.chapterId}/quizzes`;
    const base = {
      title: 'Q',
      timeLimitMinutes: null,
      maxAttempts: 1,
      passPercent: 40,
      negativeMarking: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      questionsPerAttempt: null,
      showResultImmediately: true,
      answerReveal: 'NEVER',
    };
    for (const bad of [
      { timeLimitMinutes: 0 },
      { timeLimitMinutes: -5 },
      { maxAttempts: 0 },
      { maxAttempts: 21 },
      { passPercent: 101 },
      { questionsPerAttempt: 0 },
    ]) {
      expectStatus(await w.alice.api('POST', chapter, { ...base, ...bad }), 422);
    }
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { questions: [], publish: false });
    const add = (body: unknown) =>
      w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/questions`, body);
    expectStatus(await add({ ...mcq(), negativeMarks: 5 }), 422); // penalty > marks
    expectStatus(await add({ ...mcq(), marks: 0 }), 422);
    expectStatus(await add({ ...mcq(), marks: 1.333 }), 422);
    expectStatus(
      await add({ ...mcq(), options: mcq().options.map((o) => ({ ...o, isCorrect: true })) }),
      422,
    );
    expectStatus(
      await add({
        ...trueFalse(),
        options: [...trueFalse().options, { text: 'Maybe', isCorrect: false }],
      }),
      422,
    );
    expectStatus(
      await add({ ...multi(), options: multi().options.map((o) => ({ ...o, isCorrect: false })) }),
      422,
    );
    const shortAnswer = await add(written());
    expectStatus(shortAnswer, 422); // written answers are exam-only
    // Publishing needs questions; a random subset cannot exceed the question count.
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'publish' }),
      409,
    );
    expectStatus(await add(mcq()), 201);
    const { title: _title, ...rulesOnly } = base;
    const rules = { ...rulesOnly, questionsPerAttempt: 3 };
    expectStatus(await w.alice.api('PUT', `/faculty/lessons/${quiz.lessonId}/quiz`, rules), 200);
    const publish = await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, {
      action: 'publish',
    });
    expectStatus(publish, 422);
  });

  it('freezes questions and rules once published, and enforces valid transitions', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const questionId = quiz.questions[0]!.id;
    expectStatus(await w.alice.api('PATCH', `/faculty/questions/${questionId}`, mcq(9)), 409);
    expectStatus(await w.alice.api('DELETE', `/faculty/questions/${questionId}`), 409);
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/questions`, mcq()),
      409,
    );
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'publish' }),
      409,
    );
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'reopen' }),
      409,
    );
    // Unpublish works before any attempt, and editing is possible again.
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, {
        action: 'unpublish',
      }),
      200,
    );
    expectStatus(await w.alice.api('PATCH', `/faculty/questions/${questionId}`, mcq(9)), 200);
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'publish' }),
      200,
    );
    await startQuiz(w.sam, quiz.lessonId);
    // …but not once a student has attempted it.
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, {
        action: 'unpublish',
      }),
      409,
    );
    // Deleting the lesson would destroy attempt history.
    expectStatus(await w.alice.api('DELETE', `/faculty/lessons/${quiz.lessonId}`), 409);
  });

  it('keeps the questions faculty can reorder while in draft', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { publish: false });
    const ids = quiz.questions.map((q) => q.id).reverse();
    const reordered = await w.alice.api<{ id: string; position: number }[]>(
      'PUT',
      `/faculty/quizzes/${quiz.lessonId}/question-order`,
      { questionIds: ids },
    );
    expectStatus(reordered, 200);
    assert.deepEqual(
      reordered.body.data.map((q) => q.id),
      ids,
    );
    expectStatus(
      await w.alice.api('PUT', `/faculty/quizzes/${quiz.lessonId}/question-order`, {
        questionIds: ids.slice(1),
      }),
      422,
    );
  });
});

describe('quiz attempts and scoring', () => {
  it('scores MCQ, True/False and multiple-answer questions on the server', async () => {
    at(T0);
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    assert.equal(attempt.maxScore, 6);
    expectStatus(await answer(w.sam, attempt, 'What is 2 + 3?', ['5']), 200);
    expectStatus(await answer(w.sam, attempt, 'The square root of 49 is 7.', ['False']), 200);
    expectStatus(await answer(w.sam, attempt, 'Which numbers are prime?', ['2', '3']), 200);
    const done = await submit(w.sam, attempt.id);
    assert.equal(done.status, 'SUBMITTED');
    assert.equal(done.submittedAt, T0);
    assert.equal(done.resultState, 'RELEASED');
    assert.deepEqual(done.result, {
      rawScore: 5,
      penalty: 0,
      score: 5,
      maxScore: 6,
      percent: 83.33,
      passed: true,
    });
    // Answers are revealed after submission for this quiz; each question carries its outcome.
    const review = done.review!;
    assert.deepEqual(
      review.map((q) => q.isCorrect),
      [true, false, true],
    );
  });

  it('treats a partial multiple-answer selection as wrong and applies negative marking once', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { negativeMarking: true, passPercent: 40 },
      questions: [mcq(2, 0.5), multi(3, 1), trueFalse(1, 0.25)],
    });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['4']); // −0.5
    await answer(w.sam, attempt, 'Which numbers are prime?', ['2']); // subset → −1
    await answer(w.sam, attempt, 'The square root of 49 is 7.', ['True']); // +1
    const done = await submit(w.sam, attempt.id);
    assert.deepEqual(done.result, {
      rawScore: 1,
      penalty: 1.5,
      score: 0,
      maxScore: 6,
      percent: 0,
      passed: false,
    });
    // Re-submitting does not subtract penalties again.
    const again = await submit(w.sam, attempt.id);
    assert.deepEqual(again.result, done.result);
    const stored = await prisma.attemptQuestion.findMany({
      where: { attemptId: attempt.id },
      orderBy: { position: 'asc' },
    });
    assert.deepEqual(
      stored.map((q) => Number(q.penalty)),
      [0.5, 1, 0],
    );
  });

  it('applies the pass threshold inclusively', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { passPercent: 50 },
      questions: [mcq(1), trueFalse(1)],
    });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const done = await submit(w.sam, attempt.id);
    assert.equal(done.result!.percent, 50);
    assert.equal(done.result!.passed, true);
  });

  it('never sends the answer key while the attempt runs, and ignores client-supplied correctness', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { answerReveal: 'NEVER' },
    });
    const start = await w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`);
    expectStatus(start, 201);
    assert.ok(!start.text.includes('isCorrect'), 'no correctness flags in the start response');
    assert.ok(!start.text.includes('Add the numbers'), 'no explanations either');
    const attempt = (start.body.data as { attempt: StudentAttemptDto }).attempt;
    const fetched = await w.sam.api('GET', `/student/attempts/${attempt.id}`);
    assert.ok(!fetched.text.includes('isCorrect'));
    const q = attempt.questions[0]!;
    // Over-posting correctness, marks or times is a validation error.
    for (const extra of [{ isCorrect: true }, { awardedMarks: 2 }, { answeredAt: T0 }]) {
      expectStatus(
        await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
          selectedOptionIds: [q.options[0]!.id],
          sequence: 1,
          ...extra,
        }),
        422,
      );
    }
    expectStatus(
      await w.sam.api('POST', `/student/attempts/${attempt.id}/submit`, { score: 6 }),
      422,
    );
    // An option id from another question is refused.
    expectStatus(
      await w.sam.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
        selectedOptionIds: [attempt.questions[1]!.options[0]!.id],
        sequence: 1,
      }),
      422,
    );
    // Submitted with NEVER reveal: score visible, key still not.
    const done = await submit(w.sam, attempt.id);
    assert.equal(done.review, null);
  });

  it('ignores stale autosaves (lower sequence) and stores the newest answer', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    expectStatus(await answer(w.sam, attempt, 'What is 2 + 3?', ['5'], 2), 200);
    const stale = await answer(w.sam, attempt, 'What is 2 + 3?', ['4'], 1);
    expectStatus(stale, 200);
    assert.equal((stale.body.data as { applied: boolean }).applied, false);
    const fetched = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    const q = fetched.body.data.questions.find((x) => x.prompt === 'What is 2 + 3?')!;
    assert.deepEqual(q.selectedOptionIds, [q.options.find((o) => o.text === '5')!.id]);
  });

  it('enforces the attempt limit and resumes a running attempt instead of starting another', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { rules: { maxAttempts: 2 } });
    const first = await startQuiz(w.sam, quiz.lessonId);
    const resumed = await w.sam.api<{ resumed: boolean; attempt: StudentAttemptDto }>(
      'POST',
      `/student/lessons/${quiz.lessonId}/quiz/attempts`,
    );
    expectStatus(resumed, 200);
    assert.equal(resumed.body.data.resumed, true);
    assert.equal(resumed.body.data.attempt.id, first.id);
    await submit(w.sam, first.id);
    const second = await startQuiz(w.sam, quiz.lessonId);
    assert.equal(second.attemptNumber, 2);
    await submit(w.sam, second.id);
    const third = await w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`);
    expectStatus(third, 409);
    const panel = await w.sam.api<StudentQuizDto>('GET', `/student/lessons/${quiz.lessonId}/quiz`);
    assert.equal(panel.body.data.attemptsUsed, 2);
    assert.match(panel.body.data.cannotStartReason ?? '', /used all 2 attempts/);
  });

  it('creates one attempt for concurrent start requests and one result for concurrent submits', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { rules: { maxAttempts: 1 } });
    const starts = await Promise.all(
      Array.from({ length: 6 }, () =>
        w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`),
      ),
    );
    assert.ok(
      starts.every((r) => r.status === 200 || r.status === 201 || r.status === 409),
      starts.map((r) => r.status).join(),
    );
    assert.equal(await prisma.assessmentAttempt.count({ where: { quizId: quiz.quizId } }), 1);
    const attemptId = (
      await prisma.assessmentAttempt.findFirstOrThrow({ where: { quizId: quiz.quizId } })
    ).id;
    const submits = await Promise.all(
      Array.from({ length: 5 }, () => w.sam.api('POST', `/student/attempts/${attemptId}/submit`)),
    );
    assert.ok(submits.every((r) => r.status === 200));
    assert.equal(submits.filter((r) => r.body.message === 'Attempt submitted').length, 1);
    const finalized = await prisma.assessmentAuditLog.count({
      where: { entityId: attemptId, action: 'attempt.finalized' },
    });
    assert.equal(finalized, 1, 'evaluated exactly once');
  });

  it('persists a random question subset: refreshing never changes the questions or their order', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { questionsPerAttempt: 2, shuffleQuestions: true, shuffleOptions: true },
    });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    assert.equal(attempt.questions.length, 2);
    assert.equal(
      attempt.maxScore,
      attempt.questions.reduce((sum, q) => sum + q.marks, 0),
    );
    for (let i = 0; i < 3; i++) {
      const again = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
      assert.deepEqual(
        again.body.data.questions.map((q) => [q.id, q.prompt, q.options.map((o) => o.id)]),
        attempt.questions.map((q) => [q.id, q.prompt, q.options.map((o) => o.id)]),
      );
    }
  });

  it('keeps completed attempts unchanged when the quiz is edited later (snapshots)', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { rules: { maxAttempts: 2 } });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const done = await submit(w.sam, attempt.id);
    // Faculty closes and reopens; even a source question deletion (simulated) cannot alter history.
    await prisma.assessmentQuestion.update({
      where: { id: quiz.questions[0]!.id },
      data: { prompt: 'Changed later', marks: 50 },
    });
    const after = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.deepEqual(after.body.data.result, done.result);
    assert.ok(after.body.data.questions.some((q) => q.prompt === 'What is 2 + 3?'));
  });

  it('expires a timed attempt at the server deadline, whatever the browser does', async () => {
    const start = at(T0);
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { timeLimitMinutes: 10 },
    });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    assert.equal(attempt.deadlineAt, plusMinutes(start, 10).toISOString());
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    at(plusMinutes(start, 10));
    const late = await answer(w.sam, attempt, 'The square root of 49 is 7.', ['True'], 1);
    expectStatus(late, 409);
    assert.deepEqual(late.body.error?.details, { attemptStatus: 'EXPIRED' });
    const fetched = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.equal(fetched.body.data.status, 'EXPIRED');
    assert.equal(fetched.body.data.submittedAt, plusMinutes(start, 10).toISOString());
    assert.equal(fetched.body.data.result!.score, 2, 'only the answer saved in time counts');
  });

  it('closing a quiz finalizes running attempts with their saved answers', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'close' }),
      200,
    );
    const fetched = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.equal(fetched.body.data.status, 'EXPIRED');
    assert.equal(fetched.body.data.result!.score, 2);
    expectStatus(await w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`), 409);
  });
});

describe('quiz result release', () => {
  it('hides scores until faculty publish results when they are not shown immediately', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, {
      rules: { showResultImmediately: false, answerReveal: 'AFTER_CLOSE' },
    });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    const done = await submit(w.sam, attempt.id);
    assert.equal(done.resultState, 'AWAITING_RELEASE');
    assert.equal(done.result, null);
    assert.ok(!JSON.stringify(done).includes('"score"'));
    const results = await w.sam.api<Paginated<StudentAssessmentResultItem>>(
      'GET',
      '/student/assessment-results',
    );
    assert.equal(results.body.data.items.length, 0);
    // Faculty see the score; Bob (other course) cannot publish.
    expectStatus(await w.bob.api('POST', `/faculty/quizzes/${quiz.lessonId}/publish-results`), 403);
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/publish-results`),
      200,
    );
    const released = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.equal(released.body.data.resultState, 'RELEASED');
    assert.equal(released.body.data.result!.score, 2);
    assert.equal(released.body.data.review, null, 'answers wait until the quiz closes');
    expectStatus(
      await w.alice.api('POST', `/faculty/quizzes/${quiz.lessonId}/status`, { action: 'close' }),
      200,
    );
    const revealed = await w.sam.api<StudentAttemptDto>('GET', `/student/attempts/${attempt.id}`);
    assert.ok(revealed.body.data.review);
    const list = await w.sam.api<Paginated<StudentAssessmentResultItem>>(
      'GET',
      '/student/assessment-results',
    );
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.items[0]!.kind, 'QUIZ');
  });
});

describe('quiz access control', () => {
  it('hides draft quizzes and draft lessons from students', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { publish: false });
    // Lesson draft → 404
    expectStatus(await w.sam.api('GET', `/student/lessons/${quiz.lessonId}/quiz`), 404);
    expectStatus(await w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`), 404);
    // Lesson published but quiz still draft → not available, cannot start
    expectStatus(
      await w.alice.api('PATCH', `/faculty/lessons/${quiz.lessonId}`, { status: 'PUBLISHED' }),
      200,
    );
    const panel = await w.sam.api<StudentQuizDto>('GET', `/student/lessons/${quiz.lessonId}/quiz`);
    assert.equal(panel.body.data.available, false);
    assert.equal(panel.body.data.rules, null);
    expectStatus(await w.sam.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`), 409);
  });

  it('keeps attempts private to their student and quizzes to enrolled students', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    const q = attempt.questions[0]!;
    // Una (same course) and Tara (other course) cannot read, answer or submit Sam's attempt.
    for (const other of [w.una, w.tara]) {
      expectStatus(await other.api('GET', `/student/attempts/${attempt.id}`), 404);
      expectStatus(
        await other.api('PUT', `/student/attempts/${attempt.id}/answers/${q.id}`, {
          selectedOptionIds: [],
          sequence: 9,
        }),
        404,
      );
      expectStatus(await other.api('POST', `/student/attempts/${attempt.id}/submit`), 404);
    }
    // Tara is not enrolled in course A.
    expectStatus(await w.tara.api('GET', `/student/lessons/${quiz.lessonId}/quiz`), 403);
    expectStatus(await w.tara.api('POST', `/student/lessons/${quiz.lessonId}/quiz/attempts`), 403);
    // Faculty and admins cannot use student endpoints.
    expectStatus(await w.alice.api('GET', `/student/attempts/${attempt.id}`), 403);
  });

  it('scopes quiz management and attempt review to the course’s faculty', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId);
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    await submit(w.sam, attempt.id);
    expectStatus(await w.bob.api('GET', `/faculty/quizzes/${quiz.lessonId}`), 403);
    expectStatus(
      await w.bob.api('POST', `/faculty/quizzes/${quiz.lessonId}/questions`, mcq()),
      403,
    );
    expectStatus(
      await w.bob.api('PATCH', `/faculty/questions/${quiz.questions[0]!.id}`, mcq()),
      403,
    );
    expectStatus(await w.bob.api('GET', `/faculty/quizzes/${quiz.lessonId}/attempts`), 403);
    expectStatus(await w.bob.api('GET', `/faculty/attempts/${attempt.id}`), 403);
    expectStatus(await w.admin('GET', `/faculty/quizzes/${quiz.lessonId}`), 403);
    const list = await w.bob.api<Paginated<unknown>>('GET', '/faculty/quizzes');
    assert.equal(list.body.data.items.length, 0);
    const detail = await w.alice.api<FacultyAttemptDetail>(
      'GET',
      `/faculty/attempts/${attempt.id}`,
    );
    expectStatus(detail, 200);
    assert.equal(detail.body.data.student.userId, w.sam.userId);
    assert.ok(
      detail.body.data.questions[0]!.options.some((o) => o.isCorrect),
      'faculty see the key',
    );
  });
});
