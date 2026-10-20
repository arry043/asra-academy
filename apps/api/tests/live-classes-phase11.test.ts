/**
 * PHASE 11 — Live classes through `/api/v1/admin/live-classes/*`, `/faculty/live-classes/*` and
 * `/student/live-classes` (real middleware, real database): admin scheduling with host
 * assignment, schedule validation, Google Meet provisioning through the provider port (a
 * controllable test provider — Google itself is never called), duplicate prevention, failure
 * reporting, updates/cancellation with notifications, completion and recording links.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { LiveClassDto, NotificationDto, Paginated } from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { setGoogleMeetProviderForTests } from '../src/modules/live-classes/providers/google-meet.provider.js';
import {
  MeetingProviderError,
  type MeetingProvider,
} from '../src/modules/live-classes/providers/meeting-provider.js';
import { settleNotificationDispatch } from '../src/modules/notifications/dispatcher.js';
import { buildWorld, type World } from './support/assessment.js';
import { outbox } from './support/auth.js';
import { expectStatus } from './support/catalog.js';
import { startServer } from './support/http.js';

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

beforeEach(async () => {
  await settleNotificationDispatch();
  w = await buildWorld(baseUrl);
  outbox().length = 0;
});

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const MANUAL_LINK = 'https://meet.google.com/abc-defg-hij';

/** Test double for the provider port: counts calls, can fail or stall on demand. */
class TestMeetProvider implements MeetingProvider {
  readonly id = 'google_meet' as const;
  configured = true;
  calls = 0;
  failWith: MeetingProviderError | null = null;
  delayMs = 0;

  async createMeeting() {
    this.calls += 1;
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.failWith) throw this.failWith;
    return {
      meetingId: `spaces/test${this.calls}`,
      joinUrl: `https://meet.google.com/tst-${String(this.calls).padStart(4, '0')}-abc`,
    };
  }
}

let restore: MeetingProvider | null = null;
function installProvider(provider: MeetingProvider) {
  restore = setGoogleMeetProviderForTests(provider);
}
afterEach(() => {
  if (restore) setGoogleMeetProviderForTests(restore);
  restore = null;
});

function classBody(overrides: Record<string, unknown> = {}) {
  return {
    courseId: w.courseA.courseId,
    hostFacultyProfileId: w.alice.facultyProfileId,
    title: 'Quadratics revision',
    description: 'Bring your worksheet.',
    startsAt: inDays(2),
    durationMinutes: 60,
    ...overrides,
  };
}

async function adminSchedule(overrides: Record<string, unknown> = {}) {
  const response = await w.admin<LiveClassDto>('POST', '/admin/live-classes', classBody(overrides));
  expectStatus(response, 201);
  return response;
}

async function notificationsOf(userId: string, event?: string) {
  return prisma.notification.findMany({
    where: { userId, ...(event ? { event } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

/** Moves a class into the past (it started 2 hours ago, 60 minutes long → ended). */
async function moveToPast(id: string) {
  await prisma.liveClassSession.update({
    where: { id },
    data: { startsAt: new Date(Date.now() - 2 * 3_600_000) },
  });
}

// --- Authorization --------------------------------------------------------------------------

describe('admin live-class authorization', () => {
  it('requires live_classes.manage', async () => {
    expectStatus(await w.admin('GET', '/admin/live-classes'), 200);
    expectStatus(await w.sam.api('GET', '/admin/live-classes'), 403);
    expectStatus(await w.alice.api('GET', '/admin/live-classes'), 403);
    expectStatus(await w.sam.api('POST', '/admin/live-classes', classBody()), 403);
    expectStatus(await w.alice.api('POST', '/admin/live-classes', classBody()), 403);
  });

  it('keeps faculty to their own courses and students out of management', async () => {
    const created = (await adminSchedule()).body.data;
    expectStatus(
      await w.bob.api('PATCH', `/faculty/live-classes/${created.id}`, { title: 'x' }),
      403,
    );
    expectStatus(await w.bob.api('POST', `/faculty/live-classes/${created.id}/cancel`), 403);
    expectStatus(await w.bob.api('POST', `/faculty/live-classes/${created.id}/complete`), 403);
    expectStatus(
      await w.bob.api('PUT', `/faculty/live-classes/${created.id}/recording`, {
        recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
      }),
      403,
    );
    expectStatus(
      await w.sam.api('PATCH', `/faculty/live-classes/${created.id}`, { title: 'x' }),
      403,
    );
    expectStatus(await w.sam.api('POST', `/admin/live-classes/${created.id}/cancel`), 403);
    // The assigned faculty member can manage it.
    expectStatus(
      await w.alice.api('PATCH', `/faculty/live-classes/${created.id}`, { title: 'Ok' }),
      200,
    );
  });
});

// --- Scheduling -----------------------------------------------------------------------------

describe('admin scheduling', () => {
  it('schedules a class with an assigned host and notifies eligible students and the host', async () => {
    const created = await adminSchedule({ joinUrl: MANUAL_LINK });
    const dto = created.body.data;
    assert.equal(dto.status, 'SCHEDULED');
    assert.equal(dto.provider, 'manual');
    assert.equal(dto.meetingState, 'READY');
    assert.equal(dto.timeZone, 'Asia/Kolkata');
    assert.equal(dto.hostFacultyProfileId, w.alice.facultyProfileId);
    assert.ok(dto.host);

    for (const student of [w.sam, w.una]) {
      const rows = await notificationsOf(student.userId, 'live_class.scheduled');
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.type, 'LIVE_CLASS');
      assert.equal(rows[0]!.actionUrl, '/student/classes');
      assert.match(rows[0]!.message, /IST/);
    }
    assert.equal(
      (await notificationsOf(w.tara.userId)).filter((n) => n.type === 'LIVE_CLASS').length,
      0,
    );
    const host = await notificationsOf(w.alice.userId, 'live_class.scheduled');
    assert.equal(host.length, 1);
    assert.equal(host[0]!.actionUrl, '/faculty/classes');

    await settleNotificationDispatch();
    const samEmail = outbox().find((m) => m.to === w.sam.email && m.template === 'notification');
    assert.ok(samEmail, 'the student is emailed');
    assert.match(samEmail.text, /Quadratics revision/);
    assert.match(samEmail.text, new RegExp(MANUAL_LINK.replace(/[/.]/g, '\\$&')));
    assert.match(samEmail.text, /IST \(UTC\+05:30\)/);
    assert.ok(samEmail.html?.includes('ASRA Academy'));
    assert.ok(!outbox().some((m) => m.to === w.tara.email && m.template === 'notification'));
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({
      where: { notification: { userId: w.sam.userId, event: 'live_class.scheduled' } },
    });
    assert.equal(delivery.status, 'ACCEPTED');
    assert.ok(delivery.providerMessageId);
  });

  it('refuses a host who is not assigned to the course', async () => {
    const response = await w.admin(
      'POST',
      '/admin/live-classes',
      classBody({
        hostFacultyProfileId: w.bob.facultyProfileId,
      }),
    );
    expectStatus(response, 422);
    assert.match(response.text, /hostFacultyProfileId/);
    assert.equal(await prisma.liveClassSession.count(), 0);
  });

  it('lists the eligible hosts of a course', async () => {
    const hosts = await w.admin<{ facultyProfileId: string }[]>(
      'GET',
      `/admin/courses/${w.courseA.courseId}/live-class-hosts`,
    );
    expectStatus(hosts, 200);
    assert.deepEqual(
      hosts.body.data.map((h) => h.facultyProfileId),
      [w.alice.facultyProfileId],
    );
  });

  it('rejects invalid schedule data', async () => {
    const cases: Record<string, unknown>[] = [
      { startsAt: new Date(Date.now() - 60_000).toISOString() },
      { startsAt: inDays(400) },
      { startsAt: '2026-11-02 10:30' },
      { durationMinutes: 10 },
      { durationMinutes: 600 },
      { timeZone: 'Europe/London' },
      { joinUrl: 'http://meet.google.com/abc-defg-hij' },
      { meeting: 'google_meet', joinUrl: MANUAL_LINK },
      { title: '' },
    ];
    for (const overrides of cases) {
      const response = await w.admin('POST', '/admin/live-classes', classBody(overrides));
      assert.equal(response.status, 422, `expected 422 for ${JSON.stringify(overrides)}`);
    }
    expectStatus(
      await w.admin('POST', '/admin/live-classes', classBody({ courseId: crypto.randomUUID() })),
      404,
    );
    assert.equal(await prisma.liveClassSession.count(), 0);
  });

  it('notifies only students who can access the course', async () => {
    const una = await prisma.enrollment.findFirstOrThrow({
      where: { userId: w.una.userId, courseId: w.courseA.courseId },
    });
    await prisma.enrollment.update({
      where: { id: una.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await adminSchedule();
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.scheduled')).length, 1);
    assert.equal((await notificationsOf(w.una.userId, 'live_class.scheduled')).length, 0);
  });
});

// --- Google Meet ----------------------------------------------------------------------------

describe('Google Meet links', () => {
  it('refuses an automatic link when Google Meet is not configured, creating nothing', async () => {
    const settings = await w.admin<{ googleMeet: { available: boolean } }>(
      'GET',
      '/admin/live-classes/settings',
    );
    assert.equal(settings.body.data.googleMeet.available, false);
    const response = await w.admin(
      'POST',
      '/admin/live-classes',
      classBody({ meeting: 'google_meet' }),
    );
    expectStatus(response, 503);
    assert.match(response.body.message, /not set up/);
    assert.equal(await prisma.liveClassSession.count(), 0);
    assert.equal(await prisma.notification.count({ where: { type: 'LIVE_CLASS' } }), 0);
  });

  it('creates exactly one Google Meet space and shares it with enrolled students', async () => {
    const provider = new TestMeetProvider();
    installProvider(provider);
    const created = await adminSchedule({ meeting: 'google_meet' });
    const dto = created.body.data;
    assert.equal(dto.provider, 'google_meet');
    assert.equal(dto.meetingState, 'READY');
    assert.match(dto.joinUrl ?? '', /^https:\/\/meet\.google\.com\//);
    assert.equal(provider.calls, 1);
    const row = await prisma.liveClassSession.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(row.providerMeetingId, 'spaces/test1');

    // Asking again never creates a second meeting.
    const again = await w.admin<LiveClassDto>('POST', `/admin/live-classes/${dto.id}/meeting`);
    expectStatus(again, 200);
    assert.match(again.body.message, /already exists/);
    assert.equal(provider.calls, 1);

    const student = await w.sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    assert.equal(student.body.data.items[0]!.joinUrl, dto.joinUrl);
    await settleNotificationDispatch();
    const email = outbox().find((m) => m.to === w.sam.email && m.template === 'notification');
    assert.ok(email?.text.includes(dto.joinUrl!), 'the email carries the created link');
  });

  it('reports a provider failure honestly and allows a retry', async () => {
    const provider = new TestMeetProvider();
    provider.failWith = new MeetingProviderError(
      'PERMISSION',
      'The Google Meet REST API is not enabled in the Google Cloud project.',
      403,
    );
    installProvider(provider);
    const created = await w.admin<LiveClassDto>(
      'POST',
      '/admin/live-classes',
      classBody({ meeting: 'google_meet' }),
    );
    expectStatus(created, 201);
    assert.match(created.body.message, /could not be created/);
    const dto = created.body.data;
    assert.equal(dto.meetingState, 'FAILED');
    assert.equal(dto.joinUrl, null);
    assert.match(dto.meetingError ?? '', /not enabled/);
    // Students never see provider errors and get no link.
    const student = await w.sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    assert.equal(student.body.data.items[0]!.joinUrl, null);
    assert.equal(student.body.data.items[0]!.meetingError, null);

    provider.failWith = null;
    const retried = await w.admin<LiveClassDto>('POST', `/admin/live-classes/${dto.id}/meeting`);
    expectStatus(retried, 200);
    assert.equal(retried.body.data.meetingState, 'READY');
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.updated')).length, 1);
    assert.equal(provider.calls, 2);
  });

  it('maps provider rate limiting to 429 on retry', async () => {
    const provider = new TestMeetProvider();
    installProvider(provider);
    const dto = (await adminSchedule()).body.data;
    provider.failWith = new MeetingProviderError(
      'RATE_LIMITED',
      'Google Meet is rate-limiting requests.',
      429,
    );
    expectStatus(await w.admin('POST', `/admin/live-classes/${dto.id}/meeting`), 429);
  });

  it('creates only one meeting when requests race', async () => {
    const provider = new TestMeetProvider();
    provider.delayMs = 150;
    installProvider(provider);
    const dto = (await adminSchedule()).body.data;
    const results = await Promise.all(
      [1, 2, 3].map(() => w.admin<LiveClassDto>('POST', `/admin/live-classes/${dto.id}/meeting`)),
    );
    assert.equal(provider.calls, 1);
    assert.equal(results.filter((r) => r.status === 200).length >= 1, true);
    for (const r of results) assert.ok([200, 409].includes(r.status), r.text);
    const row = await prisma.liveClassSession.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(row.providerMeetingId, 'spaces/test1');
  });

  it('never replaces a pasted link with a Google link by surprise', async () => {
    installProvider(new TestMeetProvider());
    const dto = (await adminSchedule({ joinUrl: MANUAL_LINK })).body.data;
    expectStatus(await w.admin('POST', `/admin/live-classes/${dto.id}/meeting`), 409);
  });
});

// --- Updates, cancellation, completion, recordings -----------------------------------------

describe('updates and cancellation', () => {
  it('notifies once per real schedule change', async () => {
    const dto = (await adminSchedule()).body.data;
    const newStart = inDays(3);
    expectStatus(
      await w.alice.api('PATCH', `/faculty/live-classes/${dto.id}`, { startsAt: newStart }),
      200,
    );
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.updated')).length, 1);
    // Repeating the same change, or a title-only edit, sends nothing new.
    expectStatus(
      await w.alice.api('PATCH', `/faculty/live-classes/${dto.id}`, { startsAt: newStart }),
      200,
    );
    expectStatus(
      await w.alice.api('PATCH', `/faculty/live-classes/${dto.id}`, { title: 'Renamed' }),
      200,
    );
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.updated')).length, 1);
    // A changed joining link is a real change.
    expectStatus(
      await w.alice.api('PATCH', `/faculty/live-classes/${dto.id}`, { joinUrl: MANUAL_LINK }),
      200,
    );
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.updated')).length, 2);
    // The host made these changes, so the host is not notified about them.
    assert.equal((await notificationsOf(w.alice.userId, 'live_class.updated')).length, 0);
  });

  it('cancels once, notifies once and freezes the class', async () => {
    const dto = (await adminSchedule({ joinUrl: MANUAL_LINK })).body.data;
    const cancelled = await w.admin<LiveClassDto>('POST', `/admin/live-classes/${dto.id}/cancel`);
    expectStatus(cancelled, 200);
    assert.equal(cancelled.body.data.status, 'CANCELLED');
    const again = await w.admin('POST', `/admin/live-classes/${dto.id}/cancel`);
    expectStatus(again, 200);
    assert.match(again.body.message, /already/);
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.cancelled')).length, 1);
    assert.equal((await notificationsOf(w.alice.userId, 'live_class.cancelled')).length, 1);
    expectStatus(await w.admin('PATCH', `/admin/live-classes/${dto.id}`, { title: 'Back' }), 409);
    const student = await w.sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    assert.equal(student.body.data.items[0]!.status, 'CANCELLED');
    assert.equal(student.body.data.items[0]!.joinUrl, null);
  });

  it('lets an admin reassign the host to another assigned faculty member', async () => {
    expectStatus(
      await w.admin('PUT', `/admin/courses/${w.courseA.courseId}/instructors`, {
        instructors: [
          { facultyProfileId: w.alice.facultyProfileId, isPrimary: true },
          { facultyProfileId: w.bob.facultyProfileId, isPrimary: false },
        ],
      }),
      200,
    );
    const dto = (await adminSchedule()).body.data;
    const moved = await w.admin<LiveClassDto>('PATCH', `/admin/live-classes/${dto.id}`, {
      hostFacultyProfileId: w.bob.facultyProfileId,
    });
    expectStatus(moved, 200);
    assert.equal(moved.body.data.hostFacultyProfileId, w.bob.facultyProfileId);
    assert.equal((await notificationsOf(w.bob.userId, 'live_class.scheduled')).length, 1);
  });
});

describe('completion and recordings', () => {
  it('completes a class only after it has started', async () => {
    const dto = (await adminSchedule()).body.data;
    expectStatus(await w.alice.api('POST', `/faculty/live-classes/${dto.id}/complete`), 409);
    await moveToPast(dto.id);
    const done = await w.alice.api<LiveClassDto>(
      'POST',
      `/faculty/live-classes/${dto.id}/complete`,
    );
    expectStatus(done, 200);
    assert.equal(done.body.data.status, 'COMPLETED');
    assert.ok(done.body.data.completedAt);
    const again = await w.alice.api('POST', `/faculty/live-classes/${dto.id}/complete`);
    expectStatus(again, 200);
    assert.match(again.body.message, /already/);
  });

  it('validates, normalises and access-controls recording links', async () => {
    const dto = (await adminSchedule({ joinUrl: MANUAL_LINK })).body.data;
    const path = `/faculty/live-classes/${dto.id}/recording`;
    // Not before the class has started.
    expectStatus(
      await w.alice.api('PUT', path, { recordingUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
      409,
    );
    await moveToPast(dto.id);
    for (const bad of [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/123456',
      'https://www.youtube.com/playlist?list=PL123',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'javascript:alert(1)',
    ]) {
      const response = await w.alice.api('PUT', path, { recordingUrl: bad });
      assert.equal(response.status, 422, `expected 422 for ${bad}`);
    }
    const saved = await w.alice.api<LiveClassDto>('PUT', path, {
      recordingUrl: 'https://youtu.be/dQw4w9WgXcQ?t=42',
    });
    expectStatus(saved, 200);
    assert.equal(saved.body.data.recordingUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Enrolled student: sees the recording in past classes, and no joining link any more.
    const past = await w.sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes?when=past');
    expectStatus(past, 200);
    assert.equal(
      past.body.data.items[0]!.recordingUrl,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    assert.equal(past.body.data.items[0]!.joinUrl, null);
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.recording_available')).length, 1);
    // Student of another course: the class (and so the recording) does not exist for them.
    const other = await w.tara.api<Paginated<LiveClassDto>>(
      'GET',
      '/student/live-classes?when=past',
    );
    assert.equal(other.body.data.items.length, 0);
    expectStatus(
      await w.tara.api('GET', `/student/live-classes?when=past&courseId=${w.courseA.courseId}`),
      403,
    );

    // Saving the same link again is a no-op; removing it hides it.
    expectStatus(
      await w.alice.api('PUT', path, {
        recordingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
      200,
    );
    assert.equal((await notificationsOf(w.sam.userId, 'live_class.recording_available')).length, 1);
    const removed = await w.alice.api<LiveClassDto>('PUT', path, { recordingUrl: null });
    expectStatus(removed, 200);
    assert.equal(removed.body.data.recordingUrl, null);
  });

  it('never shows a recording for a cancelled class', async () => {
    const dto = (await adminSchedule()).body.data;
    expectStatus(await w.admin('POST', `/admin/live-classes/${dto.id}/cancel`), 200);
    await moveToPast(dto.id);
    expectStatus(
      await w.admin('PUT', `/admin/live-classes/${dto.id}/recording`, {
        recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
      }),
      409,
    );
  });
});

describe('student class lists', () => {
  it('shows upcoming classes of enrolled courses with the joining link', async () => {
    await adminSchedule({ joinUrl: MANUAL_LINK });
    const list = await w.sam.api<Paginated<LiveClassDto>>(
      'GET',
      `/student/live-classes?courseId=${w.courseA.courseId}`,
    );
    expectStatus(list, 200);
    const item = list.body.data.items[0]!;
    assert.equal(item.joinUrl, MANUAL_LINK);
    assert.equal(item.hostFacultyProfileId, null, 'staff-only fields are hidden');
    assert.equal(item.course.id, w.courseA.courseId);
    assert.ok(item.host);
    const inbox = await w.sam.api<Paginated<NotificationDto>>('GET', '/notifications');
    assert.ok(inbox.body.data.items.some((n) => n.event === 'live_class.scheduled'));
  });
});
