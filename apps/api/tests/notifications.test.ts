/**
 * PHASE 11 — Notifications: the `/api/v1/notifications` inbox (recipient isolation, pagination,
 * unread counts, read state), idempotent creation, the email outbox (accepted / retried / failed /
 * skipped, no secrets in stored errors), the branded template, and the business events wired to
 * real workflows (registration, enrolment, payment, refund, assignments, exams, results).
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { NotificationDto, NotificationUnreadCountDto, Paginated } from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setEmailTransport } from '../src/email/email.service.js';
import type { EmailTransport } from '../src/email/email.types.js';
import { renderBrandedEmail } from '../src/email/templates.js';
import { createResendTransport, ResendDeliveryError } from '../src/email/transports.js';
import { setClockForTests } from '../src/lib/clock.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { applyProviderPayment, applyProviderRefund } from '../src/modules/payments/core.js';
import {
  deliverEmail,
  settleNotificationDispatch,
  sweepNotificationEmails,
} from '../src/modules/notifications/dispatcher.js';
import { notifyUsers } from '../src/modules/notifications/notifications.service.js';
import {
  answer,
  at,
  buildWorld,
  createExam,
  plusMinutes,
  startExam,
  type World,
} from './support/assessment.js';
import { outbox } from './support/auth.js';
import { apiAs, expectStatus } from './support/catalog.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
let w: World;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  await settleNotificationDispatch();
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});

let restoreTransport: EmailTransport | null = null;
beforeEach(async () => {
  await settleNotificationDispatch();
  w = await buildWorld(baseUrl);
  await settleNotificationDispatch();
  outbox().length = 0;
});
afterEach(async () => {
  await settleNotificationDispatch();
  if (restoreTransport) setEmailTransport(restoreTransport);
  restoreTransport = null;
  setClockForTests(null);
});

const spec = (key: string, email = false) => ({
  type: 'ANNOUNCEMENT' as const,
  event: 'test.event',
  title: `Title ${key}`,
  message: `Message ${key}`,
  actionUrl: '/student/dashboard',
  dedupeKey: key,
  email,
});

const events = (userId: string, event: string) =>
  prisma.notification.count({ where: { userId, event } });

// --- Inbox API ------------------------------------------------------------------------------

describe('notification inbox', () => {
  it('requires authentication', async () => {
    const visitor = apiAs(new TestClient(baseUrl), undefined);
    expectStatus(await visitor('GET', '/notifications'), 401);
    expectStatus(await visitor('GET', '/notifications/unread-count'), 401);
    expectStatus(await visitor('POST', '/notifications/read-all'), 401);
  });

  it('lists, counts, paginates and marks only the signed-in user’s notifications', async () => {
    await prisma.notification.deleteMany();
    for (let i = 0; i < 25; i += 1) await notifyUsers(prisma, [w.sam.userId], spec(`k${i}`));
    await notifyUsers(prisma, [w.tara.userId], spec('tara-only'));

    const count = await w.sam.api<NotificationUnreadCountDto>('GET', '/notifications/unread-count');
    assert.equal(count.body.data.unread, 25);
    const page1 = await w.sam.api<Paginated<NotificationDto>>('GET', '/notifications?pageSize=10');
    assert.equal(page1.body.data.items.length, 10);
    assert.equal(page1.body.data.pagination.total, 25);
    assert.equal(page1.body.data.pagination.pageCount, 3);
    const page3 = await w.sam.api<Paginated<NotificationDto>>(
      'GET',
      '/notifications?pageSize=10&page=3',
    );
    assert.equal(page3.body.data.items.length, 5);
    assert.ok(page1.body.data.items.every((n) => n.title.startsWith('Title k')));

    const first = page1.body.data.items[0]!;
    const read = await w.sam.api<NotificationDto>('POST', `/notifications/${first.id}/read`);
    expectStatus(read, 200);
    assert.ok(read.body.data.readAt);
    // Idempotent.
    expectStatus(await w.sam.api('POST', `/notifications/${first.id}/read`), 200);
    const unread = await w.sam.api<Paginated<NotificationDto>>(
      'GET',
      '/notifications?status=unread&pageSize=100',
    );
    assert.equal(unread.body.data.pagination.total, 24);

    // Another user's notification is indistinguishable from a missing one.
    const taraRow = await prisma.notification.findFirstOrThrow({
      where: { userId: w.tara.userId },
    });
    expectStatus(await w.sam.api('POST', `/notifications/${taraRow.id}/read`), 404);
    assert.equal(
      (await prisma.notification.findUniqueOrThrow({ where: { id: taraRow.id } })).readAt,
      null,
    );
    expectStatus(await w.sam.api('POST', '/notifications/not-a-uuid/read'), 422);

    const all = await w.sam.api<{ updated: number }>('POST', '/notifications/read-all');
    expectStatus(all, 200);
    assert.equal(all.body.data.updated, 24);
    const after = await w.sam.api<NotificationUnreadCountDto>('GET', '/notifications/unread-count');
    assert.equal(after.body.data.unread, 0);
    const taraCount = await w.tara.api<NotificationUnreadCountDto>(
      'GET',
      '/notifications/unread-count',
    );
    assert.equal(taraCount.body.data.unread, 1, 'read-all touched only Sam');
  });

  it('works for staff accounts too', async () => {
    await notifyUsers(prisma, [w.alice.userId], spec('faculty'));
    const list = await w.alice.api<Paginated<NotificationDto>>('GET', '/notifications');
    expectStatus(list, 200);
    assert.ok(list.body.data.items.some((n) => n.title === 'Title faculty'));
  });
});

// --- Creation & delivery --------------------------------------------------------------------

describe('notification creation and email delivery', () => {
  it('never creates a duplicate for the same event occurrence', async () => {
    const first = await notifyUsers(prisma, [w.sam.userId, w.sam.userId], spec('once', true));
    const second = await notifyUsers(prisma, [w.sam.userId], spec('once', true));
    assert.equal(first.length, 1);
    assert.equal(second.length, 0, 'no second delivery');
    assert.equal(
      await prisma.notification.count({ where: { userId: w.sam.userId, dedupeKey: 'once' } }),
      1,
    );
  });

  it('records acceptance with the provider message id', async () => {
    const [id] = await notifyUsers(prisma, [w.sam.userId], spec('accept', true));
    assert.equal(await deliverEmail(id!), 'ACCEPTED');
    const row = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: id! } });
    assert.equal(row.status, 'ACCEPTED');
    assert.ok(row.acceptedAt);
    assert.match(row.providerMessageId ?? '', /^memory-/);
    const sent = outbox().filter((m) => m.to === w.sam.email && m.template === 'notification');
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.idempotencyKey, `notification-delivery/${id}`);
    // A second attempt does nothing: the delivery is no longer claimable.
    assert.equal(await deliverEmail(id!), 'NOT_CLAIMED');
    assert.equal(outbox().filter((m) => m.to === w.sam.email).length, 1);
  });

  it('retries transient failures with backoff and gives up after the limit', async () => {
    let calls = 0;
    restoreTransport = setEmailTransport({
      name: 'failing',
      async send() {
        calls += 1;
        throw new ResendDeliveryError('application_error', 500);
      },
    });
    const notificationsBefore = await prisma.notification.count();
    const [id] = await notifyUsers(prisma, [w.sam.userId], spec('retry', true));
    const start = new Date('2026-11-01T00:00:00.000Z');
    at(start);
    assert.equal(await deliverEmail(id!), 'RETRY');
    let row = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: id! } });
    assert.equal(row.status, 'PENDING');
    assert.equal(row.attempts, 1);
    assert.ok(row.nextAttemptAt > start, 'backs off');
    assert.match(row.lastError ?? '', /application_error, status 500/);
    // Not due yet → not retried.
    assert.equal(await deliverEmail(id!), 'NOT_CLAIMED');
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      at(new Date(start.getTime() + attempt * 3_600_000));
      await sweepNotificationEmails();
    }
    row = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: id! } });
    assert.equal(row.status, 'FAILED');
    assert.equal(row.attempts, 5);
    assert.equal(calls, 5);
    // Retrying an email never repeats the business event.
    assert.equal(await prisma.notification.count(), notificationsBefore + 1);
  });

  it('fails permanently on a provider validation error without storing personal data', async () => {
    const leaky = createResendTransport({
      apiKey: 're_secret_key_value',
      client: {
        emails: {
          send: async (payload) => ({
            data: null,
            error: {
              name: 'validation_error',
              statusCode: 422,
              message: `Invalid \`to\` field: ${payload.to} (key re_secret_key_value)`,
            },
          }),
        },
      },
    });
    restoreTransport = setEmailTransport(leaky);
    const [id] = await notifyUsers(prisma, [w.sam.userId], spec('permanent', true));
    assert.equal(await deliverEmail(id!), 'FAILED');
    const row = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: id! } });
    assert.equal(row.status, 'FAILED');
    assert.equal(row.attempts, 1);
    assert.ok(!row.lastError?.includes(w.sam.email), 'no address in the stored error');
    assert.ok(!row.lastError?.includes('re_secret_key_value'), 'no key in the stored error');
  });

  it('skips a "scheduled" email for a class that was cancelled before it went out', async () => {
    restoreTransport = setEmailTransport({
      name: 'blocked',
      async send() {
        throw new Error('network down');
      },
    });
    const created = await w.admin<{ id: string }>('POST', '/admin/live-classes', {
      courseId: w.courseA.courseId,
      hostFacultyProfileId: w.alice.facultyProfileId,
      title: 'Soon cancelled',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 45,
    });
    expectStatus(created, 201);
    await settleNotificationDispatch();
    setEmailTransport(restoreTransport);
    restoreTransport = null;
    expectStatus(await w.admin('POST', `/admin/live-classes/${created.body.data.id}/cancel`), 200);
    await settleNotificationDispatch();
    const scheduled = await prisma.notificationDelivery.findFirstOrThrow({
      where: { notification: { userId: w.sam.userId, event: 'live_class.scheduled' } },
    });
    // Due again later: the retry finds the class cancelled and skips it.
    at(new Date(Date.now() + 2 * 3_600_000));
    assert.equal(await deliverEmail(scheduled.id), 'SKIPPED');
    const sent = outbox().filter((m) => m.to === w.sam.email);
    assert.equal(sent.length, 1, 'only the cancellation email');
    assert.match(sent[0]!.subject, /cancelled/);
  });

  it('skips email for inactive accounts', async () => {
    await prisma.user.update({ where: { id: w.sam.userId }, data: { status: 'SUSPENDED' } });
    const [id] = await notifyUsers(prisma, [w.sam.userId], spec('inactive', true));
    assert.equal(await deliverEmail(id!), 'SKIPPED');
    assert.equal(outbox().length, 0);
  });
});

describe('branded email template', () => {
  it('renders with and without optional parts and escapes user text', () => {
    const minimal = renderBrandedEmail({
      recipientName: 'Asha',
      subject: 'Hello',
      heading: 'Hello',
      intro: 'Plain message',
    });
    assert.match(minimal.text, /^Hello Asha,/);
    assert.ok(
      !minimal.html.includes(
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px',
      ),
    );
    const full = renderBrandedEmail({
      recipientName: '<b>Asha</b>',
      subject: 'Class <script>alert(1)</script>',
      heading: 'Class <script>alert(1)</script>',
      intro: 'Intro & "quotes"',
      details: [{ label: 'Course', value: 'Maths <i>10</i>' }],
      action: { label: 'Open', url: 'https://academy.example.com/student/classes' },
      links: [{ label: 'Join', url: 'https://meet.google.com/abc-defg-hij' }],
      footnote: 'Note',
    });
    assert.ok(!full.html.includes('<script>'));
    assert.ok(full.html.includes('&lt;script&gt;'));
    assert.ok(full.html.includes('&lt;b&gt;Asha&lt;/b&gt;'));
    assert.match(full.text, /Course: Maths <i>10<\/i>/);
    assert.match(full.text, /Join: https:\/\/meet\.google\.com/);
    assert.throws(() =>
      renderBrandedEmail({
        recipientName: 'A',
        subject: 'S',
        heading: 'H',
        intro: 'I',
        action: { label: 'Bad', url: 'javascript:alert(1)' },
      }),
    );
  });
});

// --- Business events ------------------------------------------------------------------------

describe('business events', () => {
  it('welcomes a student once the email address is verified', async () => {
    assert.equal(await events(w.sam.userId, 'registration.welcome'), 1);
    assert.equal(await events(w.alice.userId, 'registration.welcome'), 0, 'staff are not welcomed');
  });

  it('confirms FREE and ADMIN enrolments (only once the enrolment is active)', async () => {
    // buildWorld enrolled Sam in course A for free.
    assert.equal(await events(w.sam.userId, 'enrollment.activated'), 1);
    expectStatus(
      await w.admin('POST', `/admin/courses/${w.courseB.courseId}/enrollments`, {
        email: w.sam.email,
      }),
      201,
    );
    assert.equal(await events(w.sam.userId, 'enrollment.activated'), 2);
    await settleNotificationDispatch();
    assert.ok(outbox().some((m) => m.to === w.sam.email && /You are enrolled in/.test(m.subject)));
    // Re-enrolling an active student is refused and creates nothing.
    expectStatus(
      await w.admin('POST', `/admin/courses/${w.courseB.courseId}/enrollments`, {
        email: w.sam.email,
      }),
      409,
    );
    assert.equal(await events(w.sam.userId, 'enrollment.activated'), 2);
  });

  it('records a verified payment and a processed refund once each, in-app only', async () => {
    const order = await prisma.order.create({
      data: {
        reference: `ASRA-TEST-${Date.now()}`,
        userId: w.sam.userId,
        courseId: w.courseB.courseId,
        status: 'PENDING',
        mode: 'TEST',
        providerKeyId: 'rzp_test_key',
        providerOrderId: `order_${Date.now()}`,
        currency: 'INR',
        courseTitle: 'Physics 11',
        listPriceMinor: 149_900,
        amountMinor: 149_900,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const payment = {
      id: `pay_${Date.now()}`,
      orderId: order.providerOrderId,
      status: 'captured' as const,
      amountMinor: 149_900,
      currency: 'INR',
      captured: true,
      method: 'upi',
      amountRefundedMinor: 0,
      errorCode: null,
      errorDescription: null,
    };
    const first = await applyProviderPayment(order.id, payment, { source: 'webhook' });
    const second = await applyProviderPayment(order.id, payment, { source: 'fetch' });
    assert.equal(first.justPaid, true);
    assert.equal(second.justPaid, false);
    const rows = await prisma.notification.findMany({
      where: { userId: w.sam.userId, event: 'payment.received' },
      include: { deliveries: true },
    });
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.message, /₹1,499\.00/);
    assert.equal(rows[0]!.deliveries.length, 0, 'the payment email is the existing confirmation');
    // The PAYMENT enrolment does not add a second "enrolled" message (Sam's only one is the
    // free enrolment in course A made by buildWorld).
    assert.equal(await events(w.sam.userId, 'enrollment.activated'), 1);

    const paymentRow = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    const refund = {
      id: `rfnd_${Date.now()}`,
      paymentId: payment.id,
      amountMinor: 50_000,
      currency: 'INR',
      status: 'processed' as const,
      receipt: null,
    };
    await applyProviderRefund(paymentRow.id, refund);
    await applyProviderRefund(paymentRow.id, refund);
    assert.equal(await events(w.sam.userId, 'payment.refund_processed'), 1);
  });

  it('announces a published assignment to students of the course and releases results privately', async () => {
    const created = await w.alice.api<{ lessonId: string }>(
      'POST',
      `/faculty/chapters/${w.courseA.chapterId}/assignments`,
      {
        title: 'Worksheet 1',
        instructions: 'Solve 1–10.',
        maxMarks: 10,
        status: 'PUBLISHED',
      },
    );
    expectStatus(created, 201);
    const lessonId = created.body.data.lessonId;
    assert.equal(await events(w.sam.userId, 'assignment.published'), 1);
    assert.equal(await events(w.una.userId, 'assignment.published'), 1);
    assert.equal(await events(w.tara.userId, 'assignment.published'), 0);

    expectStatus(
      await w.sam.api('POST', `/student/lessons/${lessonId}/submission`, { body: 'x = 2' }),
      201,
    );
    const submission = await prisma.assignmentSubmission.findFirstOrThrow({
      where: { userId: w.sam.userId },
    });
    expectStatus(
      await w.alice.api('PUT', `/faculty/submissions/${submission.id}/grade`, { marksAwarded: 8 }),
      200,
    );
    assert.equal(
      await events(w.sam.userId, 'result.assignment_released'),
      0,
      'grading alone publishes nothing',
    );
    expectStatus(await w.alice.api('POST', `/faculty/submissions/${submission.id}/release`), 200);
    expectStatus(await w.alice.api('POST', `/faculty/submissions/${submission.id}/release`), 200);
    assert.equal(await events(w.sam.userId, 'result.assignment_released'), 1);
    assert.equal(await events(w.una.userId, 'result.assignment_released'), 0);
  });

  it('a draft assignment notifies nobody until it is published', async () => {
    const created = await w.alice.api<{ lessonId: string }>(
      'POST',
      `/faculty/chapters/${w.courseA.chapterId}/assignments`,
      { title: 'Draft', instructions: 'Later.', maxMarks: 10, status: 'DRAFT' },
    );
    expectStatus(created, 201);
    assert.equal(await events(w.sam.userId, 'assignment.published'), 0);
    expectStatus(
      await w.alice.api('PATCH', `/faculty/lessons/${created.body.data.lessonId}`, {
        status: 'PUBLISHED',
      }),
      200,
    );
    assert.equal(await events(w.sam.userId, 'assignment.published'), 1);
  });

  it('announces an exam on publication and its results only to students who attempted it', async () => {
    const OPENS = new Date('2026-11-02T04:30:00.000Z');
    const CLOSES = new Date('2026-11-02T06:30:00.000Z');
    at(new Date('2026-11-01T12:00:00.000Z'));
    const { examId } = await createExam(w.alice, w.courseA.courseId, {
      opensAt: OPENS,
      closesAt: CLOSES,
    });
    assert.equal(await events(w.sam.userId, 'examination.published'), 1);
    assert.equal(await events(w.una.userId, 'examination.published'), 1);
    assert.equal(await events(w.tara.userId, 'examination.published'), 0);

    at(plusMinutes(OPENS, 1));
    const { attempt } = await startExam(w.sam, examId);
    await answer(w.sam, attempt, 'What is 2 + 3?', ['5']);
    expectStatus(await w.sam.api('POST', `/student/attempts/${attempt.id}/submit`), 200);
    at(plusMinutes(CLOSES, 1));
    expectStatus(await w.alice.api('POST', `/faculty/exams/${examId}/publish-results`), 200);
    assert.equal(await events(w.sam.userId, 'result.exam_published'), 1);
    assert.equal(await events(w.una.userId, 'result.exam_published'), 0);
  });
});
