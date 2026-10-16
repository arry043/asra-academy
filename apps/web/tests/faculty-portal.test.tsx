/**
 * PHASE 08 web: faculty-portal helpers (IST scheduling, review states, labels), navigation
 * coverage, the shared form schemas the faculty forms validate with, server-rendered markup of
 * the faculty components, and the session gate (no faculty content before the session is known).
 *
 * Interactive flows (create assignment, grade, release, schedule) need a browser and a live API;
 * their API behaviour is covered by apps/api/tests/faculty-portal.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AuthUser, FacultyCourseCard } from '@asra/types';
import {
  assignmentCreateSchema,
  facultyProfileUpdateSchema,
  gradeSubmissionSchema,
  liveClassCreateSchema,
  studentSubmissionSchema,
} from '@asra/validation';

import { AuthProvider } from '@/components/auth/auth-provider';
import { FacultyCourseTile } from '@/components/faculty/faculty-dashboard';
import { FacultyShell, facultyNavigation } from '@/components/faculty/faculty-shell';
import { ClassBadge, ReviewBadge } from '@/components/faculty/faculty-ui';
import {
  classTiming,
  facultyCourseHref,
  formatMarks,
  isFaculty,
  istInputToIso,
  isoToIstInput,
  parseCourseTab,
  percentLabel,
  reviewState,
} from '@/lib/faculty/portal';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const user = (roles: string[]): AuthUser => ({
  id: 'u1',
  email: 'teacher@example.test',
  fullName: 'Asha Teacher',
  emailVerified: true,
  roles,
  permissions: [],
});

describe('faculty helpers', () => {
  it('recognises faculty accounts only by role', () => {
    assert.equal(isFaculty(user(['FACULTY'])), true);
    assert.equal(isFaculty(user(['STUDENT'])), false);
    assert.equal(isFaculty(user(['ADMIN'])), false);
    assert.equal(isFaculty(null), false);
  });

  it('reads datetime-local input as IST, whatever the browser time zone', () => {
    assert.equal(istInputToIso('2026-11-02T10:30'), '2026-11-02T10:30:00+05:30');
    assert.equal(
      new Date(istInputToIso('2026-11-02T10:30')!).toISOString(),
      '2026-11-02T05:00:00.000Z',
    );
    assert.equal(istInputToIso(''), null);
    assert.equal(istInputToIso('2026-02-30T10:00'), undefined);
    assert.equal(istInputToIso('2026-11-02 10:30'), undefined);
    assert.equal(istInputToIso('2026-11-02T24:00'), undefined);
    assert.equal(isoToIstInput('2026-11-02T05:00:00.000Z'), '2026-11-02T10:30');
    assert.equal(isoToIstInput(null), '');
    assert.equal(isoToIstInput('not a date'), '');
  });

  it('derives review states and labels without inventing data', () => {
    assert.equal(reviewState({ status: 'SUBMITTED', resultReleasedAt: null }), 'AWAITING_REVIEW');
    assert.equal(reviewState({ status: 'GRADED', resultReleasedAt: null }), 'GRADED');
    assert.equal(
      reviewState({ status: 'GRADED', resultReleasedAt: '2026-11-01T00:00:00Z' }),
      'RELEASED',
    );
    assert.equal(formatMarks(18, 20), '18 / 20');
    assert.equal(formatMarks(null, 20), null);
    assert.equal(percentLabel(null), '—');
    assert.equal(percentLabel(0), '0%');
  });

  it('never reports a class as live — only scheduled, ended or cancelled', () => {
    const now = Date.parse('2026-11-02T06:00:00Z');
    const during = { status: 'SCHEDULED' as const, endsAt: '2026-11-02T06:30:00Z' };
    assert.equal(classTiming(during, now), 'scheduled');
    assert.equal(classTiming({ ...during, endsAt: '2026-11-02T05:59:00Z' }, now), 'ended');
    assert.equal(classTiming({ ...during, status: 'CANCELLED' }, now), 'cancelled');
  });

  it('builds workspace links and falls back to the overview tab', () => {
    assert.equal(facultyCourseHref('c 1'), '/faculty/courses/c%201');
    assert.equal(facultyCourseHref('c1', 'curriculum'), '/faculty/courses/c1?tab=curriculum');
    assert.equal(parseCourseTab('students'), 'students');
    assert.equal(parseCourseTab('settings'), 'overview');
    assert.equal(parseCourseTab(null), 'overview');
  });

  it('has navigation for every Phase 08 faculty route', () => {
    const hrefs = facultyNavigation.flatMap((group) => group.items.map((item) => item.href));
    for (const route of [
      'dashboard',
      'courses',
      'content',
      'students',
      'classes',
      'assignments',
      'submissions',
      'quizzes',
      'exams',
      'performance',
      'profile',
    ]) {
      assert.ok(hrefs.includes(`/faculty/${route}`), route);
    }
  });
});

describe('form schemas used by the faculty and student forms', () => {
  it('validates grading input before it reaches the API', () => {
    assert.equal(gradeSubmissionSchema.safeParse({ marksAwarded: 18 }).success, true);
    assert.equal(gradeSubmissionSchema.safeParse({ marksAwarded: 2.5 }).success, false);
    assert.equal(gradeSubmissionSchema.safeParse({ marksAwarded: -1 }).success, false);
    // Over-posting a reviewer or release time is rejected (strict schema).
    assert.equal(
      gradeSubmissionSchema.safeParse({ marksAwarded: 5, gradedById: 'x' }).success,
      false,
    );
  });

  it('requires explicit offsets for schedule and due times', () => {
    const base = { title: 'Revision', durationMinutes: 60 };
    assert.equal(
      liveClassCreateSchema.safeParse({ ...base, startsAt: '2026-11-02T10:30:00+05:30' }).success,
      true,
    );
    assert.equal(
      liveClassCreateSchema.safeParse({ ...base, startsAt: '2026-11-02T10:30' }).success,
      false,
    );
    assert.equal(
      liveClassCreateSchema.safeParse({
        ...base,
        startsAt: '2026-11-02T10:30:00+05:30',
        joinUrl: 'javascript:alert(1)',
      }).success,
      false,
    );
    assert.equal(
      assignmentCreateSchema.safeParse({
        title: 'A',
        instructions: 'Do it',
        maxMarks: 10,
        dueAt: 'soon',
      }).success,
      false,
    );
  });

  it('accepts only safe student links and self-service profile fields', () => {
    assert.equal(
      studentSubmissionSchema.safeParse({ body: 'Answer', attachmentUrl: '' }).success,
      true,
    );
    assert.equal(
      studentSubmissionSchema.safeParse({ body: 'Answer', attachmentUrl: 'http://x.example.com' })
        .success,
      false,
    );
    assert.equal(studentSubmissionSchema.safeParse({ body: '   ' }).success, false);
    assert.equal(facultyProfileUpdateSchema.safeParse({ bio: 'Hi' }).success, true);
    assert.equal(facultyProfileUpdateSchema.safeParse({ isPublic: true }).success, false);
  });
});

const course: FacultyCourseCard = {
  id: 'course-1',
  title: 'Mathematics for Class 10',
  slug: 'mathematics-class-10',
  thumbnailUrl: null,
  category: { name: 'School Education', slug: 'school' },
  class: { name: 'Class 10', slug: 'class-10' },
  stream: null,
  subject: { name: 'Mathematics', slug: 'maths' },
  status: 'DRAFT',
  visibility: 'PUBLIC',
  isPrimary: true,
  activeStudents: 12,
  lessons: { published: 4, draft: 2 },
  assignments: 3,
  pendingReviews: 5,
  upcomingClasses: 1,
  updatedAt: '2026-10-15T08:00:00.000Z',
};

describe('faculty markup', () => {
  it('renders an assigned course with its real counts and workspace links', () => {
    const markup = html(<FacultyCourseTile course={course} />);
    assert.match(markup, /Mathematics for Class 10/);
    assert.match(markup, /Primary faculty/);
    assert.match(markup, />12</);
    assert.match(markup, /4 published · 2 draft/);
    assert.match(markup, /href="\/faculty\/courses\/course-1"/);
    assert.match(markup, /href="\/faculty\/courses\/course-1\?tab=curriculum"/);
    const content = html(<FacultyCourseTile course={course} mode="content" />);
    assert.match(content, /Manage curriculum/);
  });

  it('labels review and class states', () => {
    assert.match(
      html(<ReviewBadge item={{ status: 'GRADED', resultReleasedAt: null }} />),
      /Graded — not released/,
    );
    assert.match(
      html(<ClassBadge item={{ status: 'CANCELLED', endsAt: '2026-11-02T06:30:00Z' }} />),
      /Cancelled/,
    );
  });

  it('shows nothing of the portal until the session is confirmed', () => {
    // Minimal App Router context so the shell's navigation hooks can render on the server.
    const router = {
      back() {},
      forward() {},
      refresh() {},
      push() {},
      replace() {},
      prefetch() {},
    } as unknown as React.ContextType<typeof AppRouterContext>;
    const markup = html(
      <AppRouterContext.Provider value={router}>
        <AuthProvider>
          <FacultyShell>
            <p>Secret teaching data</p>
          </FacultyShell>
        </AuthProvider>
      </AppRouterContext.Provider>,
    );
    assert.doesNotMatch(markup, /Secret teaching data/);
    assert.match(markup, /Checking your session/);
  });
});
