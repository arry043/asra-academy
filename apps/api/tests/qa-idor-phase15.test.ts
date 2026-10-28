/**
 * PHASE 15 (QA) — horizontal access control (IDOR). Resources addressed by a raw id must be
 * reachable only by their owner (students) or by faculty assigned to the course:
 *
 *   - Una (same course as Sam) and Tara (other course) cannot read, answer or submit Sam's attempt
 *   - Bob (faculty of course B) cannot read Sam's course-A attempt; Alice (course A) can
 *   - Una cannot read, verify, refresh or print Sam's order/receipt
 *
 * Every refusal must leave the owner's record unchanged and must not leak its contents.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setClockForTests } from '../src/lib/clock.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { buildWorld, createQuiz, mcq, startQuiz, type World } from './support/assessment.js';
import { expectStatus } from './support/catalog.js';
import { uniqueSuffix } from './support/fixtures.js';
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

const DENIED = new Set([403, 404]);

function assertDenied(response: { status: number; text: string }, secret: string, what: string) {
  assert.ok(DENIED.has(response.status), `${what}: expected 403/404, got ${response.status}`);
  assert.ok(!response.text.includes(secret), `${what}: response leaks the resource`);
}

describe('assessment attempts', () => {
  it('cannot be read, answered or submitted by another student', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { questions: [mcq()] });
    const attempt = await startQuiz(w.sam, quiz.lessonId);
    const question = attempt.questions[0]!;

    for (const [name, other] of [
      ['same-course student', w.una],
      ['other-course student', w.tara],
    ] as const) {
      assertDenied(
        await other.api('GET', `/student/attempts/${attempt.id}`),
        question.prompt,
        `${name} GET`,
      );
      assertDenied(
        await other.api('PUT', `/student/attempts/${attempt.id}/answers/${question.id}`, {
          selectedOptionIds: [question.options[0]!.id],
          sequence: 1,
        }),
        question.prompt,
        `${name} PUT answer`,
      );
      assertDenied(
        await other.api('POST', `/student/attempts/${attempt.id}/submit`),
        question.prompt,
        `${name} submit`,
      );
    }

    const row = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert.equal(row.userId, w.sam.userId);
    assert.equal(row.submittedAt, null, 'the attempt must still be open');
    // The owner is unaffected.
    expectStatus(await w.sam.api('GET', `/student/attempts/${attempt.id}`), 200);
  });

  it('is visible to the course faculty but not to faculty of another course', async () => {
    const quiz = await createQuiz(w.alice, w.courseA.chapterId, { questions: [mcq()] });
    const attempt = await startQuiz(w.sam, quiz.lessonId);

    assertDenied(
      await w.bob.api('GET', `/faculty/attempts/${attempt.id}`),
      w.sam.email,
      'unassigned faculty',
    );
    expectStatus(await w.alice.api('GET', `/faculty/attempts/${attempt.id}`), 200);
  });
});

describe('orders and receipts', () => {
  it('cannot be read, verified, refreshed or printed by another student', async () => {
    const reference = `ASRA-T-${uniqueSuffix()}`;
    const order = await prisma.order.create({
      data: {
        reference,
        userId: w.sam.userId,
        courseId: w.courseA.courseId,
        mode: 'TEST',
        status: 'PAID',
        providerKeyId: 'rzp_test_x',
        providerOrderId: `order_${uniqueSuffix()}`,
        currency: 'INR',
        courseTitle: 'Course',
        listPriceMinor: 10_000,
        amountMinor: 10_000,
        expiresAt: new Date(Date.now() + 3_600_000),
        paidAt: new Date(),
      },
    });

    assertDenied(await w.una.api('GET', `/student/orders/${order.id}`), reference, 'GET order');
    assertDenied(
      await w.una.api('GET', `/student/orders/${order.id}/receipt`),
      reference,
      'GET receipt',
    );
    assertDenied(
      await w.una.api('POST', `/student/orders/${order.id}/refresh`),
      reference,
      'refresh',
    );
    assertDenied(
      await w.una.api('POST', `/student/orders/${order.id}/verify`, {
        razorpayOrderId: order.providerOrderId,
        razorpayPaymentId: 'pay_ABCDEFGHIJKLMN',
        razorpaySignature: 'a'.repeat(64),
      }),
      reference,
      'verify',
    );

    const list = await w.una.api<{ items: unknown[] }>('GET', '/student/orders');
    expectStatus(list, 200);
    assert.ok(!list.text.includes(reference), 'order list leaks another student’s order');

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(after.status, 'PAID');
    assert.equal(after.userId, w.sam.userId);
    expectStatus(await w.sam.api('GET', `/student/orders/${order.id}`), 200);
  });
});
