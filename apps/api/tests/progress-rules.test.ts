/** PHASE 07 — pure progress rules (no database): course percentage and video heartbeat credit. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCourseProgress,
  countsTowardProgress,
  creditVideoHeartbeat,
  FIRST_HEARTBEAT_CREDIT_SECONDS,
  isCourseComplete,
} from '../src/modules/student/progress.js';

describe('calculateCourseProgress', () => {
  it('returns null (not 0) when a course has no eligible lessons', () => {
    const progress = calculateCourseProgress([], new Set(['x']), null);
    assert.deepEqual(progress, {
      completedLessons: 0,
      totalLessons: 0,
      percent: null,
      completedAt: null,
    });
    assert.equal(isCourseComplete(progress), false);
  });

  it('counts duplicates once, ignores foreign completions and floors the percentage', () => {
    const progress = calculateCourseProgress(['a', 'b', 'c', 'a'], new Set(['a', 'z']), null);
    assert.equal(progress.totalLessons, 3);
    assert.equal(progress.completedLessons, 1);
    assert.equal(progress.percent, 33);
    const almost = calculateCourseProgress(
      Array.from({ length: 200 }, (_, i) => String(i)),
      new Set(Array.from({ length: 199 }, (_, i) => String(i))),
      null,
    );
    assert.equal(almost.percent, 99, '100% only when every lesson is complete');
    assert.equal(isCourseComplete(calculateCourseProgress(['a'], new Set(['a']), null)), true);
  });

  it('excludes quiz and assignment placeholders', () => {
    assert.equal(countsTowardProgress('VIDEO'), true);
    assert.equal(countsTowardProgress('TEXT'), true);
    assert.equal(countsTowardProgress('QUIZ'), false);
    assert.equal(countsTowardProgress('ASSIGNMENT'), false);
  });
});

describe('creditVideoHeartbeat', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);

  it('bounds the first heartbeat of a session', () => {
    const credit = creditVideoHeartbeat(
      { watchedSeconds: 0, heartbeatAt: null },
      { positionSeconds: 50, playedSeconds: 120 },
      600,
      now,
    );
    assert.equal(credit.watchedSeconds, FIRST_HEARTBEAT_CREDIT_SECONDS);
    assert.equal(credit.positionSeconds, 50);
  });

  it('never credits more than the wall-clock time since the last heartbeat', () => {
    const credit = creditVideoHeartbeat(
      { watchedSeconds: 100, heartbeatAt: secondsAgo(10) },
      { positionSeconds: 300, playedSeconds: 60 },
      600,
      now,
    );
    assert.equal(credit.watchedSeconds, 112, '10 s elapsed + 2 s slack');
  });

  it('gives a seek no credit and caps watched time and position at the duration', () => {
    const seek = creditVideoHeartbeat(
      { watchedSeconds: 20, heartbeatAt: secondsAgo(15) },
      { positionSeconds: 500, playedSeconds: 0 },
      600,
      now,
    );
    assert.equal(seek.watchedSeconds, 20);
    assert.equal(seek.positionSeconds, 500);

    const capped = creditVideoHeartbeat(
      { watchedSeconds: 590, heartbeatAt: secondsAgo(60) },
      { positionSeconds: 9_999, playedSeconds: 60 },
      600,
      now,
    );
    assert.equal(capped.watchedSeconds, 600);
    assert.equal(capped.positionSeconds, 600);
    assert.equal(capped.reachedThreshold, true);
  });

  it('reaches the threshold at 90% of a configured duration only', () => {
    const below = creditVideoHeartbeat(
      { watchedSeconds: 80, heartbeatAt: secondsAgo(60) },
      { positionSeconds: 89, playedSeconds: 9 },
      100,
      now,
    );
    assert.equal(below.reachedThreshold, false);
    const at = creditVideoHeartbeat(
      { watchedSeconds: 80, heartbeatAt: secondsAgo(60) },
      { positionSeconds: 90, playedSeconds: 10 },
      100,
      now,
    );
    assert.equal(at.reachedThreshold, true);

    const unknownDuration = creditVideoHeartbeat(
      { watchedSeconds: 10_000, heartbeatAt: secondsAgo(60) },
      { positionSeconds: 10_000, playedSeconds: 60 },
      null,
      now,
    );
    assert.equal(unknownDuration.reachedThreshold, false, 'no completion claim without duration');
  });

  it('ignores clock skew that would produce a negative elapsed time', () => {
    const credit = creditVideoHeartbeat(
      { watchedSeconds: 5, heartbeatAt: new Date(now.getTime() + 60_000) },
      { positionSeconds: 10, playedSeconds: 30 },
      100,
      now,
    );
    assert.equal(credit.watchedSeconds, 7, 'only the 2 s slack');
  });
});
