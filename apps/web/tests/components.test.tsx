/**
 * Component contract tests: server-render each component and assert on the markup (semantics,
 * ARIA wiring and missing-data handling). Interactive behaviour (focus traps, keyboard, toasts) is
 * verified in a real browser — see docs/DESIGN-SYSTEM.md §11.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AssignmentCard } from '@/components/asra/assignments/assignment-card';
import { CourseCategoryCard } from '@/components/asra/categories/course-category-card';
import { CourseCard } from '@/components/asra/courses/course-card';
import { ExamCard } from '@/components/asra/exams/exam-card';
import { FacultyCard } from '@/components/asra/faculty/faculty-card';
import { LiveClassCard } from '@/components/asra/live-classes/live-class-card';
import { ProgressCard } from '@/components/asra/progress/progress-card';
import { FormField } from '@/components/auth/form-controls';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableEmpty } from '@/components/ui/table';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('Button', () => {
  it('disables, marks busy and swaps the label while loading', () => {
    const out = html(
      <Button loading loadingText="Saving…">
        Save
      </Button>,
    );
    assert.match(out, /<button[^>]*disabled=""/);
    assert.match(out, /aria-busy="true"/);
    assert.match(out, /Saving…/);
    assert.doesNotMatch(out, />Save</);
  });
  it('renders the child element with asChild', () => {
    const out = html(
      <Button asChild>
        <a href="/courses">Courses</a>
      </Button>,
    );
    assert.match(out, /^<a [^>]*href="\/courses"/);
    assert.doesNotMatch(out, /<button/);
  });
});

describe('Field', () => {
  it('links label, hint and error to the control', () => {
    const out = html(
      <Field id="email" label="Email" hint="We never share it." error="Enter a valid email.">
        <Input type="email" />
      </Field>,
    );
    assert.match(out, /<label[^>]*for="email"/);
    assert.match(out, /<input[^>]*id="email"/);
    assert.match(out, /aria-describedby="email-error email-hint"/);
    assert.match(out, /aria-invalid="true"/);
    assert.match(out, /id="email-error"[^>]*>.*Enter a valid email\./);
  });
  it('omits aria-invalid and describedby when there is nothing to describe', () => {
    const out = html(
      <Field id="name" label="Name">
        <Input />
      </Field>,
    );
    // (`aria-invalid:` also appears inside Tailwind class names, so match the attribute form.)
    assert.doesNotMatch(out, / aria-invalid="/);
    assert.doesNotMatch(out, / aria-describedby="/);
  });
});

describe('auth FormField (Phase 03 regression)', () => {
  it('keeps name = id so the auth forms can read FormData', () => {
    const out = html(<FormField id="email" label="Email" type="email" error="Required" />);
    assert.match(out, /<input[^>]*name="email"/);
    assert.match(out, /<input[^>]*id="email"/);
    assert.match(out, /aria-invalid="true"/);
  });
});

describe('Alert', () => {
  it('uses role=alert for errors and role=status otherwise', () => {
    assert.match(html(<Alert tone="error">x</Alert>), /role="alert"/);
    assert.match(html(<Alert tone="success">x</Alert>), /role="status"/);
  });
});

describe('Progress', () => {
  it('clamps the value and exposes it to assistive technology', () => {
    const out = html(<Progress value={150} label="Course" />);
    assert.match(out, /role="progressbar"/);
    assert.match(out, /aria-valuenow="100"/);
    assert.match(out, /aria-valuetext="100%"/);
    assert.match(out, /aria-label="Course"/);
  });
  it('does not render a progressbar for missing data', () => {
    const out = html(<Progress value={null} label="Course" />);
    assert.doesNotMatch(out, /role="progressbar"/);
    assert.match(out, /Course: No progress data/);
  });
});

describe('Avatar', () => {
  it('renders initials with the full name for screen readers when there is no image', () => {
    const out = html(<Avatar name="Demo Student" status="online" />);
    assert.match(out, /DS/);
    assert.match(out, /sr-only">Demo Student</);
    assert.match(out, /sr-only">Online</);
  });
});

describe('Pagination', () => {
  it('disables Previous on the first page and marks the current page', () => {
    const out = html(<Pagination page={1} pageCount={5} getHref={(p) => `?page=${p}`} />);
    assert.match(out, /<button[^>]*disabled=""[^>]*aria-label="Previous page"/);
    assert.match(out, /aria-current="page"/);
    assert.match(out, /aria-label="Go to page 2"[^>]*href="\?page=2"/);
    assert.match(out, /<nav aria-label="Pagination"/);
  });
  it('disables Next on the last page', () => {
    const out = html(<Pagination page={5} pageCount={5} getHref={(p) => `?page=${p}`} />);
    assert.match(out, /<button[^>]*disabled=""[^>]*aria-label="Next page"/);
  });
});

describe('Table', () => {
  it('renders an empty state spanning all columns', () => {
    const out = html(
      <Table scrollLabel="Students">
        <TableBody>
          <TableEmpty colSpan={4} title="No students yet" />
        </TableBody>
      </Table>,
    );
    assert.match(out, /role="region"[^>]*aria-label="Students"[^>]*tabindex="0"/);
    assert.match(out, /colSpan="4"|colspan="4"/);
    assert.match(out, /No students yet/);
  });
});

describe('Education components', () => {
  it('CourseCard handles missing optional data', () => {
    const out = html(<CourseCard title="Only a title" />);
    assert.match(out, /<h3[^>]*>Only a title<\/h3>/);
    assert.doesNotMatch(out, /<img/);
    assert.doesNotMatch(out, /<a /);
    assert.doesNotMatch(out, /<dl/);
  });
  it('CourseCard flags drafts but not published courses', () => {
    assert.match(html(<CourseCard title="x" status="DRAFT" />), /Draft/);
    assert.doesNotMatch(html(<CourseCard title="x" status="PUBLISHED" />), /Published/);
  });
  it('FacultyCard falls back to initials without a photo', () => {
    const out = html(<FacultyCard name="Demo Faculty" />);
    assert.match(out, /DF/);
    assert.doesNotMatch(out, /aria-label="Subjects"/);
  });
  it('CourseCategoryCard hides counts without data and sets RTL for Urdu', () => {
    const plain = html(<CourseCategoryCard name="English" />);
    assert.doesNotMatch(plain, /\d+ courses?/);
    const urdu = html(<CourseCategoryCard name="اردو" lang="ur" courseCount={0} />);
    assert.match(urdu, /lang="ur" dir="rtl"/);
    assert.match(urdu, /0 courses/);
  });
  it('LiveClassCard shows Join only when live with a safe http(s) URL', () => {
    const live = html(<LiveClassCard title="x" status="live" joinUrl="https://example.com/join" />);
    assert.match(
      live,
      /href="https:\/\/example.com\/join"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    );
    assert.match(live, /opens in a new tab/);
    for (const props of [
      { status: 'live' as const },
      { status: 'live' as const, joinUrl: 'javascript:alert(1)' },
      { status: 'scheduled' as const, joinUrl: 'https://example.com/join' },
    ]) {
      assert.doesNotMatch(html(<LiveClassCard title="x" {...props} />), /Join class/);
    }
  });
  it('LiveClassCard renders the start time in IST inside <time>', () => {
    const out = html(
      <LiveClassCard title="x" status="scheduled" startsAt="2026-10-14T11:00:00Z" />,
    );
    assert.match(out, /<time dateTime="2026-10-14T11:00:00.000Z">14 Oct 2026, 4:30 pm<\/time>/);
  });
  it('ExamCard and AssignmentCard omit invalid dates', () => {
    assert.doesNotMatch(
      html(<ExamCard title="x" status="scheduled" scheduledAt="nope" />),
      /<time/,
    );
    assert.doesNotMatch(html(<AssignmentCard title="x" status="pending" dueAt="nope" />), /Due/);
  });
  it('AssignmentCard shows a result only for graded work', () => {
    assert.match(
      html(<AssignmentCard title="x" status="graded" resultLabel="18 / 20" />),
      /18 \/ 20/,
    );
    assert.doesNotMatch(
      html(<AssignmentCard title="x" status="submitted" resultLabel="18 / 20" />),
      /18 \/ 20/,
    );
  });
  it('ProgressCard handles missing, complete and out-of-range values', () => {
    assert.match(html(<ProgressCard title="x" value={null} />), /No progress yet/);
    const done = html(<ProgressCard title="x" value={20} max={20} />);
    assert.match(done, /Completed/);
    assert.match(done, /aria-valuenow="20"/);
    assert.match(html(<ProgressCard title="x" value={-4} />), /aria-valuenow="0"/);
  });
});
