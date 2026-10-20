/**
 * PHASE 11 web: live-class state helpers (completed, join/recording eligibility), the shared
 * schemas the scheduling and recording forms validate with (YouTube normalisation, time zone,
 * Google Meet vs pasted link), notification helpers (badge text, same-site links only) and the
 * server-rendered class badge.
 *
 * Interactive flows (schedule, retry Google Meet, add recording, mark read) need a browser and a
 * live API; their API behaviour is covered by apps/api/tests/live-classes-phase11.test.ts and
 * apps/api/tests/notifications.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  adminLiveClassCreateSchema,
  liveClassCreateSchema,
  liveClassRecordingSchema,
  youtubeVideoId,
} from '@asra/validation';

import { ClassBadge } from '@/components/faculty/faculty-ui';
import { canAddRecording, canCompleteClass, canJoinClass, classTiming } from '@/lib/faculty/portal';
import {
  bellLabel,
  notificationHref,
  notificationsPagePath,
  relativeTime,
  unreadBadgeText,
} from '@/lib/notifications';

const NOW = Date.parse('2026-11-02T06:00:00Z');
const upcoming = {
  status: 'SCHEDULED' as const,
  startsAt: '2026-11-02T07:00:00Z',
  endsAt: '2026-11-02T08:00:00Z',
  joinUrl: 'https://meet.google.com/abc-defg-hij',
};
const started = { ...upcoming, startsAt: '2026-11-02T05:30:00Z', endsAt: '2026-11-02T06:30:00Z' };
const ended = { ...upcoming, startsAt: '2026-11-02T04:00:00Z', endsAt: '2026-11-02T05:00:00Z' };

describe('live-class state helpers', () => {
  it('distinguishes scheduled, ended, completed and cancelled', () => {
    assert.equal(classTiming(upcoming, NOW), 'scheduled');
    assert.equal(classTiming(ended, NOW), 'ended');
    assert.equal(classTiming({ ...ended, status: 'COMPLETED' }, NOW), 'completed');
    assert.equal(classTiming({ ...upcoming, status: 'CANCELLED' }, NOW), 'cancelled');
  });

  it('offers Join only for a scheduled class that has not ended and has a link', () => {
    assert.equal(canJoinClass(upcoming, NOW), true);
    assert.equal(canJoinClass(started, NOW), true);
    assert.equal(canJoinClass({ ...upcoming, joinUrl: null }, NOW), false);
    assert.equal(canJoinClass(ended, NOW), false);
    assert.equal(canJoinClass({ ...upcoming, status: 'CANCELLED' }, NOW), false);
  });

  it('allows completion and recordings only once a class has started', () => {
    assert.equal(canCompleteClass(upcoming, NOW), false);
    assert.equal(canCompleteClass(started, NOW), true);
    assert.equal(canCompleteClass({ ...ended, status: 'COMPLETED' }, NOW), false);
    assert.equal(canAddRecording(upcoming, NOW), false);
    assert.equal(canAddRecording(ended, NOW), true);
    assert.equal(canAddRecording({ ...ended, status: 'COMPLETED' }, NOW), true);
    assert.equal(canAddRecording({ ...ended, status: 'CANCELLED' }, NOW), false);
  });

  it('renders a completed badge', () => {
    const html = renderToStaticMarkup(
      <ClassBadge item={{ status: 'COMPLETED', endsAt: ended.endsAt }} />,
    );
    assert.match(html, /Completed/);
  });
});

describe('live-class form schemas', () => {
  const base = {
    title: 'Revision',
    startsAt: '2026-11-02T10:30:00+05:30',
    durationMinutes: 60,
  };

  it('accepts IST only and keeps Google Meet and a pasted link exclusive', () => {
    assert.equal(
      liveClassCreateSchema.safeParse({ ...base, timeZone: 'Asia/Kolkata' }).success,
      true,
    );
    assert.equal(liveClassCreateSchema.safeParse({ ...base, timeZone: 'UTC' }).success, false);
    assert.equal(
      liveClassCreateSchema.safeParse({ ...base, meeting: 'google_meet' }).success,
      true,
    );
    assert.equal(
      liveClassCreateSchema.safeParse({
        ...base,
        meeting: 'google_meet',
        joinUrl: 'https://meet.google.com/abc-defg-hij',
      }).success,
      false,
    );
    assert.equal(
      liveClassCreateSchema.safeParse({ ...base, startsAt: '2026-11-02T10:30' }).success,
      false,
    );
  });

  it('requires a course and a host for admin scheduling', () => {
    assert.equal(adminLiveClassCreateSchema.safeParse(base).success, false);
    assert.equal(
      adminLiveClassCreateSchema.safeParse({
        ...base,
        courseId: crypto.randomUUID(),
        hostFacultyProfileId: crypto.randomUUID(),
      }).success,
      true,
    );
  });

  it('normalises YouTube links and refuses everything else', () => {
    const canonical = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    for (const input of [
      canonical,
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=tracking',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      const parsed = liveClassRecordingSchema.safeParse({ recordingUrl: input });
      assert.equal(parsed.success && parsed.data.recordingUrl, canonical, input);
    }
    for (const input of [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/1234',
      'https://www.youtube.com/playlist?list=PL1',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=tooshort',
      'javascript:alert(1)',
    ]) {
      assert.equal(youtubeVideoId(input), null, input);
      assert.equal(
        liveClassRecordingSchema.safeParse({ recordingUrl: input }).success,
        false,
        input,
      );
    }
    const cleared = liveClassRecordingSchema.safeParse({ recordingUrl: '' });
    assert.equal(cleared.success && cleared.data.recordingUrl, null);
  });
});

describe('notification helpers', () => {
  it('caps the badge and labels the bell for screen readers', () => {
    assert.equal(unreadBadgeText(0), null);
    assert.equal(unreadBadgeText(3), '3');
    assert.equal(unreadBadgeText(42), '9+');
    assert.equal(bellLabel(0), 'Notifications');
    assert.equal(bellLabel(2), 'Notifications, 2 unread');
  });

  it('only follows same-site paths', () => {
    assert.equal(notificationHref({ actionUrl: '/student/classes' }), '/student/classes');
    assert.equal(notificationHref({ actionUrl: null }), null);
    assert.equal(notificationHref({ actionUrl: '//evil.example/x' }), null);
    assert.equal(notificationHref({ actionUrl: 'https://evil.example' }), null);
    assert.equal(notificationHref({ actionUrl: '/\\evil.example' }), null);
  });

  it('routes the bell to the current portal', () => {
    assert.equal(notificationsPagePath('/admin/courses'), '/admin/notifications');
    assert.equal(notificationsPagePath('/faculty/dashboard'), '/faculty/notifications');
    assert.equal(notificationsPagePath('/student/classes'), '/student/notifications');
  });

  it('describes recent times and defers older ones to a date', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    assert.equal(relativeTime('2026-11-10T11:59:40Z', now), 'just now');
    assert.equal(relativeTime('2026-11-10T11:30:00Z', now), '30 min ago');
    assert.equal(relativeTime('2026-11-10T07:00:00Z', now), '5 h ago');
    assert.equal(relativeTime('2026-11-09T12:00:00Z', now), '1 day ago');
    assert.equal(relativeTime('2026-10-01T12:00:00Z', now), null);
  });
});
