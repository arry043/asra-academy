import type { PublicationCheck, PublicationIssue } from '@asra/types';
import { lessonContentIssue, type LessonContentType, type ResourceType } from '@asra/validation';

/**
 * Publication requirements (docs/COURSE-MANAGEMENT.md §3.2). A course may be PUBLISHED only when
 * every rule below holds. The same check runs:
 *   - when an administrator publishes (→ 422 listing every unmet rule),
 *   - in the course detail response (so the UI can show a checklist before publishing),
 *   - after any change to a PUBLISHED course or its curriculum (→ the change is rolled back if it
 *     would leave a live course ineligible; unpublish first to make such changes).
 *
 * This is a pure function over a snapshot so the rules are unit-testable without a database.
 */

interface RefSnapshot {
  name: string;
  isActive: boolean;
}

export interface PublicationSnapshot {
  description: string | null;
  category: RefSnapshot | null;
  class: RefSnapshot | null;
  stream: RefSnapshot | null;
  subject: RefSnapshot | null;
  /** `assignable` = the faculty account is ACTIVE and still holds the FACULTY role. */
  instructors: { assignable: boolean }[];
  lessons: {
    id: string;
    title: string;
    status: string;
    contentType: LessonContentType;
    body: string | null;
    resources: { type: ResourceType }[];
  }[];
}

export const PUBLICATION_RULES = {
  DESCRIPTION_REQUIRED: 'Add a course description',
  PLACEMENT_REQUIRED: 'Choose a category, or both a class and a subject',
  INSTRUCTOR_REQUIRED: 'Assign at least one active faculty member',
  PUBLISHED_LESSON_REQUIRED: 'Mark at least one lesson as published (ready for students)',
} as const;

export function evaluatePublication(course: PublicationSnapshot): PublicationCheck {
  const issues: PublicationIssue[] = [];
  const add = (code: string, path: string[], message: string) =>
    issues.push({ code, path, message });

  if (!course.description || course.description.trim().length === 0) {
    add('DESCRIPTION_REQUIRED', ['description'], PUBLICATION_RULES.DESCRIPTION_REQUIRED);
  }

  if (!course.category && !(course.class && course.subject)) {
    add('PLACEMENT_REQUIRED', ['categoryId'], PUBLICATION_RULES.PLACEMENT_REQUIRED);
  }
  const relations = [
    ['category', 'categoryId', course.category],
    ['class', 'classId', course.class],
    ['stream', 'streamId', course.stream],
    ['subject', 'subjectId', course.subject],
  ] as const;
  for (const [label, field, ref] of relations) {
    if (ref && !ref.isActive) {
      add(
        `${label.toUpperCase()}_INACTIVE`,
        [field],
        `The ${label} “${ref.name}” is inactive. Reactivate it or choose another ${label}.`,
      );
    }
  }

  if (!course.instructors.some((instructor) => instructor.assignable)) {
    add('INSTRUCTOR_REQUIRED', ['instructors'], PUBLICATION_RULES.INSTRUCTOR_REQUIRED);
  }

  const published = course.lessons.filter((lesson) => lesson.status === 'PUBLISHED');
  if (published.length === 0) {
    add('PUBLISHED_LESSON_REQUIRED', ['curriculum'], PUBLICATION_RULES.PUBLISHED_LESSON_REQUIRED);
  }
  for (const lesson of published) {
    const problem = lessonContentIssue(lesson);
    if (problem) {
      add(
        'LESSON_CONTENT_MISSING',
        ['curriculum', lesson.id],
        `Lesson “${lesson.title}”: ${problem.toLowerCase()}`,
      );
    }
  }

  return { eligible: issues.length === 0, issues };
}
