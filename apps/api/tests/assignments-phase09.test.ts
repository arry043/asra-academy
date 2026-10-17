/**
 * PHASE 09 — Assignment lifecycle additions over HTTP (docs/ASSESSMENTS.md §6): server-time
 * due-date enforcement, late policy, resubmission with archived versions, private faculty notes,
 * audited grade history and result privacy. The PHASE 08 behaviour stays covered by
 * faculty-portal.test.ts.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  FacultyAssignmentDetail,
  StudentAssignmentDto,
  SubmissionDetailDto,
  SubmissionListItem,
  Paginated,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma } from '../src/database/prisma.js';
import { setClockForTests } from '../src/lib/clock.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { at, buildWorld, plusMinutes, type World } from './support/assessment.js';
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

const NOW = new Date('2026-11-02T04:30:00.000Z');
const DUE = new Date('2026-11-05T12:30:00.000Z');

beforeEach(async () => {
  w = await buildWorld(baseUrl);
  at(NOW);
});

async function createAssignment(overrides: Record<string, unknown> = {}) {
  const response = await w.alice.api<FacultyAssignmentDetail>(
    'POST',
    `/faculty/chapters/${w.courseA.chapterId}/assignments`,
    {
      title: 'Algebra worksheet',
      instructions: 'Solve every question and show your working.',
      maxMarks: 20,
      dueAt: DUE.toISOString(),
      status: 'PUBLISHED',
      ...overrides,
    },
  );
  expectStatus(response, 201);
  return response.body.data;
}

const submit = (student: World['sam'], lessonId: string, body: Record<string, unknown>) =>
  student.api<StudentAssignmentDto>('POST', `/student/lessons/${lessonId}/submission`, body);

async function submissionOf(lessonId: string) {
  const list = await w.alice.api<Paginated<SubmissionListItem>>(
    'GET',
    `/faculty/submissions?lessonId=${lessonId}`,
  );
  return list.body.data.items;
}

describe('assignment submission policy', () => {
  it('persists the server acceptance time and decides lateness on the server', async () => {
    const assignment = await createAssignment();
    assert.equal(assignment.settings!.allowLateSubmissions, true);
    assert.equal(assignment.settings!.allowResubmission, false);
    const onTime = await submit(w.sam, assignment.lessonId, { body: 'x = 2 or x = 3' });
    expectStatus(onTime, 201);
    assert.equal(onTime.body.data.submission!.submittedAt, NOW.toISOString());
    assert.equal(onTime.body.data.submission!.late, false);
    // A client-provided timestamp is rejected outright (strict body).
    expectStatus(
      await submit(w.una, assignment.lessonId, { body: 'late', submittedAt: NOW.toISOString() }),
      422,
    );
    at(plusMinutes(DUE, 1));
    const late = await submit(w.una, assignment.lessonId, { body: 'Sorry, late' });
    expectStatus(late, 201);
    assert.equal(late.body.data.submission!.late, true);
    // The flag is stored: moving the due date later does not rewrite history.
    at(NOW);
    expectStatus(
      await w.alice.api('PUT', `/faculty/lessons/${assignment.lessonId}/assignment`, {
        maxMarks: 20,
        dueAt: plusMinutes(DUE, 600).toISOString(),
      }),
      200,
    );
    const items = await submissionOf(assignment.lessonId);
    assert.deepEqual(items.map((i) => i.late).sort(), [false, true]);
  });

  it('refuses late work when the assignment does not accept it', async () => {
    const assignment = await createAssignment({ allowLateSubmissions: false });
    at(new Date(DUE.getTime() - 1));
    const panel = await w.sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(panel.body.data.canSubmit, true);
    at(new Date(DUE.getTime() + 1));
    const closed = await w.sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(closed.body.data.canSubmit, false);
    assert.match(closed.body.data.cannotSubmitReason ?? '', /does not accept late submissions/);
    const refused = await submit(w.sam, assignment.lessonId, { body: 'Too late' });
    expectStatus(refused, 409);
  });

  it('allows resubmission before grading only, keeping every earlier version', async () => {
    const assignment = await createAssignment({ allowResubmission: true });
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'First try' }), 201);
    at(plusMinutes(NOW, 30));
    const second = await submit(w.sam, assignment.lessonId, {
      body: 'Second try',
      attachmentUrl: 'https://docs.example.com/my-work',
    });
    expectStatus(second, 201);
    assert.equal(second.body.data.submission!.version, 2);
    assert.equal(second.body.data.submission!.body, 'Second try');
    assert.equal(second.body.data.submission!.submittedAt, plusMinutes(NOW, 30).toISOString());
    const [item] = await submissionOf(assignment.lessonId);
    const detail = await w.alice.api<SubmissionDetailDto>(
      'GET',
      `/faculty/submissions/${item!.id}`,
    );
    assert.deepEqual(
      detail.body.data.revisions.map((r) => [r.version, r.body, r.submittedAt]),
      [[1, 'First try', NOW.toISOString()]],
    );
    expectStatus(
      await w.alice.api('PUT', `/faculty/submissions/${item!.id}/grade`, { marksAwarded: 15 }),
      200,
    );
    const afterGrade = await submit(w.sam, assignment.lessonId, { body: 'Third try' });
    expectStatus(afterGrade, 409);
    assert.match(afterGrade.body.message, /already been graded/);
  });

  it('keeps one submission when resubmission is off, and validates the payload', async () => {
    const assignment = await createAssignment();
    expectStatus(await submit(w.sam, assignment.lessonId, { body: '   ' }), 422);
    expectStatus(
      await submit(w.sam, assignment.lessonId, {
        body: 'ok',
        attachmentUrl: 'http://insecure.example.com',
      }),
      422,
    );
    expectStatus(
      await submit(w.sam, assignment.lessonId, {
        body: 'ok',
        attachmentUrl: 'javascript:alert(1)',
      }),
      422,
    );
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'x'.repeat(20_001) }), 422);
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'Answer' }), 201);
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'Again' }), 409);
    const panel = await w.sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(panel.body.data.fileUploads.available, false, 'uploads are reported, never faked');
  });
});

describe('grading, history and privacy', () => {
  it('validates marks, audits every grade change and keeps unreleased marks and notes private', async () => {
    const assignment = await createAssignment();
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'Answer' }), 201);
    const [item] = await submissionOf(assignment.lessonId);
    const grade = (body: Record<string, unknown>) =>
      w.alice.api<SubmissionDetailDto>('PUT', `/faculty/submissions/${item!.id}/grade`, body);
    expectStatus(await grade({ marksAwarded: -1 }), 422);
    expectStatus(await grade({ marksAwarded: 21 }), 422);
    expectStatus(await grade({ marksAwarded: 1.5 }), 422);
    expectStatus(await grade({ marksAwarded: '10' }), 422);
    expectStatus(
      await w.bob.api('PUT', `/faculty/submissions/${item!.id}/grade`, { marksAwarded: 5 }),
      403,
    );

    expectStatus(
      await grade({ marksAwarded: 10, feedback: 'Good start', facultyNote: 'Check method in Q3' }),
      200,
    );
    // An identical retry adds no history entry.
    expectStatus(
      await grade({ marksAwarded: 10, feedback: 'Good start', facultyNote: 'Check method in Q3' }),
      200,
    );
    const regraded = await grade({ marksAwarded: 12, feedback: 'Good work' });
    expectStatus(regraded, 200);
    assert.equal(regraded.body.data.facultyNote, 'Check method in Q3', 'note kept when omitted');

    // Unreleased: the student sees neither marks nor feedback nor the note.
    const before = await w.sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(before.body.data.submission!.result, null);
    assert.equal(before.body.data.submission!.state, 'SUBMITTED');
    assert.ok(!before.text.includes('Check method'));
    assert.ok(!before.text.includes('Good work'));

    expectStatus(await w.alice.api('POST', `/faculty/submissions/${item!.id}/release`), 200);
    expectStatus(await grade({ marksAwarded: 15 }), 409); // released results are final
    const detail = await w.alice.api<SubmissionDetailDto>(
      'GET',
      `/faculty/submissions/${item!.id}`,
    );
    assert.deepEqual(
      detail.body.data.gradeHistory.map((h) => [h.action, h.marksAwarded, h.previousMarks]),
      [
        ['graded', 10, null],
        ['regraded', 12, 10],
        ['released', 12, null],
      ],
    );
    const released = await w.sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.deepEqual(released.body.data.submission!.result!.marksAwarded, 12);
    assert.ok(!released.text.includes('Check method'), 'faculty note never reaches the student');
  });

  it('isolates students and courses', async () => {
    const assignment = await createAssignment();
    expectStatus(await submit(w.sam, assignment.lessonId, { body: 'Sam’s private answer' }), 201);
    const una = await w.una.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(una.body.data.submission, null);
    assert.ok(!una.text.includes('private answer'));
    expectStatus(
      await w.tara.api('GET', `/student/lessons/${assignment.lessonId}/assignment`),
      403,
    );
    const [item] = await submissionOf(assignment.lessonId);
    expectStatus(await w.bob.api('GET', `/faculty/submissions/${item!.id}`), 403);
    expectStatus(await w.sam.api('GET', `/faculty/submissions/${item!.id}`), 403);
  });
});
