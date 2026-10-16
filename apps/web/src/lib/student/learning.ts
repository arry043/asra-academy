import type { AuthUser, CourseProgressDto, LessonContentType, StudentCourseRef } from '@asra/types';

/**
 * Pure helpers for the student portal (PHASE 07). No React, no fetching — shared by components
 * and the web tests.
 */

export function isStudent(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles.includes('STUDENT'));
}

/** Player URL for a lesson; without a lesson the player resumes where the student left off. */
export function learnHref(courseId: string, lessonId?: string | null): string {
  const base = `/student/learn/${encodeURIComponent(courseId)}`;
  return lessonId ? `${base}?lesson=${encodeURIComponent(lessonId)}` : base;
}

export function courseHref(courseId: string): string {
  return `/student/courses/${encodeURIComponent(courseId)}`;
}

/** "School Education · Class 10 · Mathematics" from whatever the course has. */
export function courseEyebrow(course: Pick<StudentCourseRef, 'category' | 'class' | 'subject'>) {
  return [course.category?.name, course.class?.name, course.subject?.name]
    .filter(Boolean)
    .join(' · ');
}

/** "2 of 5 lessons complete" — or a clear message when nothing counts yet. */
export function progressDetail(progress: CourseProgressDto): string {
  if (progress.totalLessons === 0) return 'No lessons to complete yet';
  return `${progress.completedLessons} of ${progress.totalLessons} lessons complete`;
}

export const LESSON_TYPE_LABELS: Record<LessonContentType, string> = {
  VIDEO: 'Video',
  PDF: 'PDF notes',
  DOCUMENT: 'Document',
  LINK: 'External resource',
  QUIZ: 'Quiz',
  ASSIGNMENT: 'Assignment',
  TEXT: 'Reading',
};

/** "4:05", "1:02:03" — for video positions and durations given in seconds. */
export function formatClock(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return null;
  }
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** "2.4 MB" — or `null` when the size is unknown. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

// --- Video ----------------------------------------------------------------------------------

/**
 * How a video link can be played. The API only returns validated https:// URLs; this decides
 * whether the browser can play the file itself (with progress telemetry), embed a known
 * provider's privacy-enhanced player (no telemetry), or only open the link.
 */
export type VideoSource =
  | { kind: 'file'; url: string }
  | { kind: 'embed'; provider: 'YouTube' | 'Vimeo'; embedUrl: string; url: string }
  | { kind: 'link'; url: string };

const VIDEO_FILE = /\.(mp4|m4v|webm|ogg|ogv|mov)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function detectVideoSource(url: string, mimeType?: string | null): VideoSource {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'link', url };
  }
  if (parsed.protocol !== 'https:') return { kind: 'link', url };

  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);
  let youtubeId: string | null = null;
  if (host === 'youtu.be') youtubeId = segments[0] ?? null;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtubeId =
      segments[0] === 'watch'
        ? parsed.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(segments[0] ?? '')
          ? (segments[1] ?? null)
          : null;
  }
  if (youtubeId && YOUTUBE_ID.test(youtubeId)) {
    return {
      kind: 'embed',
      provider: 'YouTube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
      url,
    };
  }
  if (host === 'vimeo.com' && /^\d+$/.test(segments[0] ?? '')) {
    return {
      kind: 'embed',
      provider: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${segments[0]}?dnt=1`,
      url,
    };
  }
  if (host === 'player.vimeo.com' && segments[0] === 'video' && /^\d+$/.test(segments[1] ?? '')) {
    return {
      kind: 'embed',
      provider: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${segments[1]}?dnt=1`,
      url,
    };
  }
  if (mimeType?.startsWith('video/') || VIDEO_FILE.test(parsed.pathname)) {
    return { kind: 'file', url };
  }
  return { kind: 'link', url };
}

/** How often the player sends a heartbeat while playing (the API bounds each credit). */
export const HEARTBEAT_INTERVAL_MS = 15_000;
/** Same limit as the API's `videoProgressSchema`. */
export const MAX_HEARTBEAT_SECONDS = 120;

/**
 * Accumulates seconds actually played from `timeupdate` events. Jumps (seeks, or a tab that was
 * asleep) are not counted: only small forward steps add up. `take()` hands whole seconds to the
 * next heartbeat and keeps the remainder.
 */
export function createPlaybackTracker(maxStepSeconds = 2.5) {
  let last: number | null = null;
  let pending = 0;
  return {
    time(current: number) {
      if (last !== null) {
        const step = current - last;
        if (step > 0 && step <= maxStepSeconds) pending += step;
      }
      last = current;
    },
    seek(current: number) {
      last = current;
    },
    take(): number {
      const whole = Math.min(Math.floor(pending), MAX_HEARTBEAT_SECONDS);
      pending -= whole;
      return whole;
    },
    get pending() {
      return pending;
    },
  };
}
