/**
 * PHASE 07 web: student-portal helpers (video source detection, playback tracking, formatting),
 * navigation coverage, and server-rendered markup of the learning components (curriculum,
 * lesson content, course cards, unavailable states).
 *
 * Interactive flows (enrolment dialog, mark complete, video heartbeats against a live API) need a
 * browser; they were exercised against the real API — see docs/STUDENT-LMS.md §9.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

import type { StudentCurriculumModule, StudentLessonDto } from '@asra/types';

import { AuthProvider } from '@/components/auth/auth-provider';
import { CourseOutline, CurriculumNav } from '@/components/student/curriculum-nav';
import { LessonContent } from '@/components/student/lesson-content';
import { studentNavigation } from '@/components/student/student-shell';
import { EnrolledCourseCard, FeatureUnavailable } from '@/components/student/student-ui';
import {
  createPlaybackTracker,
  detectVideoSource,
  formatBytes,
  formatClock,
  isStudent,
  learnHref,
  MAX_HEARTBEAT_SECONDS,
  progressDetail,
} from '@/lib/student/learning';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('detectVideoSource', () => {
  it('plays direct video files natively (telemetry available)', () => {
    assert.deepEqual(detectVideoSource('https://cdn.example.com/a/lesson.mp4'), {
      kind: 'file',
      url: 'https://cdn.example.com/a/lesson.mp4',
    });
    assert.equal(detectVideoSource('https://cdn.example.com/stream', 'video/webm').kind, 'file');
  });

  it('embeds YouTube and Vimeo through their privacy-enhanced players', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      const source = detectVideoSource(url);
      assert.equal(source.kind, 'embed', url);
      assert.equal(
        source.kind === 'embed' && source.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
      );
    }
    const vimeo = detectVideoSource('https://vimeo.com/123456789');
    assert.equal(
      vimeo.kind === 'embed' && vimeo.embedUrl,
      'https://player.vimeo.com/video/123456789?dnt=1',
    );
  });

  it('falls back to a plain link for anything else (never embeds unknown hosts)', () => {
    assert.equal(detectVideoSource('https://videos.example.com/quadratics-1').kind, 'link');
    assert.equal(detectVideoSource('https://www.youtube.com/watch?v=<script>').kind, 'link');
    assert.equal(detectVideoSource('http://cdn.example.com/lesson.mp4').kind, 'link');
    assert.equal(detectVideoSource('javascript:alert(1)').kind, 'link');
    assert.equal(detectVideoSource('not a url').kind, 'link');
  });
});

describe('createPlaybackTracker', () => {
  it('counts normal playback, ignores seeks and jumps, and hands out whole seconds', () => {
    const tracker = createPlaybackTracker();
    for (let t = 0; t <= 10; t += 0.25) tracker.time(t); // 10 s played
    tracker.time(300); // jump forward (seek without a seeked event): not counted
    tracker.seek(20);
    tracker.time(20.5);
    assert.equal(tracker.take(), 10);
    assert.ok(Math.abs(tracker.pending - 0.5) < 1e-9);
    tracker.time(19); // backwards: not counted
    assert.equal(tracker.take(), 0);
  });

  it('never hands out more than the API accepts per heartbeat', () => {
    const tracker = createPlaybackTracker();
    for (let t = 0; t <= 400; t += 1) tracker.time(t);
    assert.equal(tracker.take(), MAX_HEARTBEAT_SECONDS);
    assert.equal(tracker.take(), MAX_HEARTBEAT_SECONDS);
  });
});

describe('student helpers', () => {
  it('formats and links', () => {
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(3723), '1:02:03');
    assert.equal(formatClock(null), null);
    assert.equal(formatBytes(2_500_000), '2.4 MB');
    assert.equal(formatBytes(null), null);
    assert.equal(learnHref('c1', 'l 1'), '/student/learn/c1?lesson=l%201');
    assert.equal(learnHref('c1'), '/student/learn/c1');
    assert.equal(
      progressDetail({ completedLessons: 0, totalLessons: 0, percent: null, completedAt: null }),
      'No lessons to complete yet',
    );
    assert.equal(
      isStudent({
        id: '1',
        email: 'a@b.c',
        fullName: 'A',
        emailVerified: true,
        roles: ['STUDENT'],
        permissions: [],
      }),
      true,
    );
    assert.equal(isStudent(null), false);
  });

  it('has navigation for every Phase 07 student route', () => {
    const hrefs = studentNavigation.flatMap((group) => group.items.map((item) => item.href));
    for (const route of [
      'dashboard',
      'courses',
      'classes',
      'assignments',
      'quizzes',
      'exams',
      'progress',
      'results',
      'certificates',
      'profile',
      'history',
      'payments',
    ]) {
      assert.ok(hrefs.includes(`/student/${route}`), route);
    }
  });
});

const modules: StudentCurriculumModule[] = [
  {
    id: 'm1',
    title: 'Algebra',
    description: null,
    chapters: [
      {
        id: 'c1',
        title: 'Quadratic equations',
        description: null,
        lessons: [
          {
            id: 'l1',
            title: 'Introduction',
            contentType: 'VIDEO',
            durationSeconds: 600,
            resourceCount: 1,
            countsTowardProgress: true,
            completedAt: '2026-10-16T08:00:00.000Z',
          },
          {
            id: 'l2',
            title: 'Worked examples',
            contentType: 'PDF',
            durationSeconds: null,
            resourceCount: 1,
            countsTowardProgress: true,
            completedAt: null,
          },
        ],
      },
    ],
  },
];

describe('curriculum rendering', () => {
  it('links lessons in order and marks completion and the current lesson', () => {
    const out = html(<CurriculumNav courseId="course-1" modules={modules} currentLessonId="l2" />);
    assert.ok(out.indexOf('Introduction') < out.indexOf('Worked examples'));
    assert.match(out, /href="\/student\/learn\/course-1\?lesson=l1"/);
    assert.match(out, /aria-current="page"[^>]*>[\s\S]*Worked examples/);
    assert.match(out, /1 of 2 done/);
    assert.match(out, /\(completed\)/);
    assert.match(out, /10:00/);
  });

  it('shows titles only before enrolment (no lesson links)', () => {
    const out = html(
      <CourseOutline
        outline={[
          {
            title: 'Algebra',
            description: null,
            chapters: [
              {
                title: 'Quadratics',
                lessons: [{ title: 'Introduction', contentType: 'VIDEO', durationSeconds: null }],
              },
            ],
          },
        ]}
      />,
    );
    assert.match(out, /Introduction/);
    assert.doesNotMatch(out, /href=/);
  });
});

function lesson(overrides: Partial<StudentLessonDto>): StudentLessonDto {
  return {
    id: 'l1',
    title: 'Lesson',
    description: null,
    contentType: 'TEXT',
    body: null,
    durationSeconds: null,
    course: { id: 'c', title: 'Course' },
    module: { id: 'm', title: 'Module' },
    chapter: { id: 'ch', title: 'Chapter' },
    resources: [],
    progress: null,
    countsTowardProgress: true,
    navigation: { previous: null, next: null, position: 1, total: 1 },
    ...overrides,
  };
}

const features = {
  quiz: { available: false, message: 'Online quiz attempts are not available yet.' },
  assignment: { available: false, message: 'Online assignment submission is not available yet.' },
};

// QUIZ lessons mount the (client) quiz panel, which needs the app router.
const router = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const renderLesson = (dto: StudentLessonDto) =>
  html(
    <AppRouterContext.Provider value={router}>
      <AuthProvider>
        <LessonContent lesson={dto} features={features} onVideoProgress={() => {}} />
      </AuthProvider>
    </AppRouterContext.Provider>,
  );

describe('lesson content', () => {
  it('renders staff text as text, never as HTML', () => {
    const out = renderLesson(lesson({ body: '<script>alert(1)</script>\nLine two' }));
    assert.doesNotMatch(out, /<script>/);
    assert.match(out, /&lt;script&gt;/);
  });

  it('plays a direct video file and opens other resources safely', () => {
    const out = renderLesson(
      lesson({
        contentType: 'VIDEO',
        resources: [
          {
            id: 'r1',
            title: 'Lecture',
            type: 'VIDEO',
            mimeType: 'video/mp4',
            sizeBytes: null,
            access: { kind: 'external', url: 'https://cdn.example.com/lecture.mp4' },
          },
          {
            id: 'r2',
            title: 'Stored notes',
            type: 'PDF',
            mimeType: null,
            sizeBytes: null,
            access: { kind: 'unavailable', reason: 'File downloads are not available yet.' },
          },
        ],
      }),
    );
    assert.match(out, /<video[^>]*src="https:\/\/cdn.example.com\/lecture.mp4"/);
    assert.match(out, /target="_blank" rel="noopener noreferrer"/);
    assert.match(out, /File downloads are not available yet\./);
  });

  it('shows an unavailable state for a video lesson without a video', () => {
    const out = renderLesson(lesson({ contentType: 'VIDEO' }));
    assert.match(out, /video for this lesson is not available yet/);
    assert.doesNotMatch(out, /<video/);
  });

  it('shows quiz instructions and mounts the online quiz panel (PHASE 09)', () => {
    const out = renderLesson(
      lesson({ contentType: 'QUIZ', body: 'Answer five questions.', countsTowardProgress: false }),
    );
    assert.match(out, /Online quiz attempts are not available yet\./);
    assert.match(out, /Instructions/);
    assert.match(out, /does not count towards your course progress/);
    // The panel loads the quiz state from the API; nothing is rendered from fake data.
    assert.match(out, /Loading quiz…/);
  });
});

describe('cards and states', () => {
  it('renders an enrolled course with real progress and a resume link', () => {
    const out = html(
      <EnrolledCourseCard
        course={{
          id: 'c1',
          title: 'Class 10 Mathematics',
          slug: 'class-10-mathematics',
          thumbnailUrl: null,
          category: null,
          class: { name: 'Class 10', slug: 'class-10' },
          stream: null,
          subject: { name: 'Mathematics', slug: 'mathematics' },
        }}
        progress={{ completedLessons: 1, totalLessons: 4, percent: 25, completedAt: null }}
        resumeLesson={{
          lessonId: 'l2',
          lessonTitle: 'Worked examples',
          contentType: 'PDF',
          chapterTitle: 'Quadratics',
          moduleTitle: 'Algebra',
        }}
        lastActivityAt="2026-10-16T08:00:00.000Z"
      />,
    );
    assert.match(out, /25%/);
    assert.match(out, /1 of 4 lessons complete/);
    assert.match(out, /href="\/student\/learn\/c1\?lesson=l2"/);
    assert.match(out, /Continue learning/);
  });

  it('renders the API message for unavailable capabilities', () => {
    const out = html(
      <FeatureUnavailable
        title="No payment history"
        feature={{ available: false, message: 'Online payments are not enabled yet.' }}
        icon={null}
      />,
    );
    assert.match(out, /No payment history/);
    assert.match(out, /Online payments are not enabled yet\./);
  });
});
