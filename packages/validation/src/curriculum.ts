import { z } from 'zod';
import { optionalTextSchema } from './common.js';
import type { ResourceType } from './content.js';

/**
 * Curriculum (PHASE 06): Course → Module → Chapter → Lesson → Resource.
 * Shared by the admin API and the curriculum editor. See docs/COURSE-MANAGEMENT.md §4–5.
 */

/**
 * The six lesson kinds required by PHASE 06, stored in the `lesson_content_type` enum.
 * `LINK` is the "External resource" kind and `TEXT` (Phase 02) is kept for written lessons.
 * QUIZ and ASSIGNMENT are placeholders — instructions plus optional resources — until the
 * assessment engine exists (PHASE 09); there is no question bank, submission or grading yet.
 */
export const LESSON_CONTENT_TYPES = [
  'VIDEO',
  'PDF',
  'DOCUMENT',
  'LINK',
  'QUIZ',
  'ASSIGNMENT',
  'TEXT',
] as const;

export type LessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

/** Lessons are drafted and made live individually; ARCHIVED is not used for lessons. */
export const LESSON_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

/** Short labels such as "1" or "A" are legitimate unit names, so only emptiness is rejected. */
export const curriculumTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters');

const sectionFields = { title: curriculumTitleSchema, description: optionalTextSchema(5000) };

export const moduleCreateSchema = z.object(sectionFields).strict();
export const moduleUpdateSchema = z.object(sectionFields).partial().strict();
export const chapterCreateSchema = z.object(sectionFields).strict();
export const chapterUpdateSchema = z.object(sectionFields).partial().strict();

const lessonFields = {
  title: curriculumTitleSchema,
  description: optionalTextSchema(5000),
  contentType: z.enum(LESSON_CONTENT_TYPES),
  /** Written content: the lesson text, or quiz/assignment instructions. Plain text/markdown. */
  body: optionalTextSchema(50_000),
  status: z.enum(LESSON_STATUSES),
  /** Expected length in seconds (e.g. a video's running time); up to 24 hours. */
  durationSeconds: z.number().int().min(1).max(86_400).nullable().optional(),
};

export const lessonCreateSchema = z
  .object({ ...lessonFields, status: z.enum(LESSON_STATUSES).default('DRAFT') })
  .strict();
export const lessonUpdateSchema = z.object(lessonFields).partial().strict();

/** Sibling order: every current child id exactly once, in the desired order. */
export const reorderSchema = z
  .object({
    orderedIds: z
      .array(z.uuid())
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, 'Each item may appear only once'),
  })
  .strict();

/**
 * What makes a lesson "have content" — used for publication eligibility (API) and for the
 * "needs content" hints in the curriculum editor (web). Keep both sides on this one definition.
 */
export const LESSON_CONTENT_REQUIREMENTS: Record<
  LessonContentType,
  { resourceTypes: readonly ResourceType[]; body: boolean; description: string }
> = {
  VIDEO: { resourceTypes: ['VIDEO'], body: false, description: 'at least one video resource' },
  PDF: { resourceTypes: ['PDF'], body: false, description: 'at least one PDF resource' },
  DOCUMENT: {
    resourceTypes: ['DOCUMENT', 'PRESENTATION'],
    body: false,
    description: 'at least one document or presentation resource',
  },
  LINK: {
    resourceTypes: ['EXTERNAL_LINK'],
    body: false,
    description: 'at least one external link resource',
  },
  QUIZ: { resourceTypes: [], body: true, description: 'quiz instructions' },
  ASSIGNMENT: { resourceTypes: [], body: true, description: 'assignment instructions' },
  TEXT: { resourceTypes: [], body: true, description: 'lesson text' },
};

/** Returns a reason when a lesson lacks the content its type requires, otherwise `null`. */
export function lessonContentIssue(lesson: {
  contentType: LessonContentType;
  body: string | null;
  resources: readonly { type: ResourceType }[];
}): string | null {
  const requirement = LESSON_CONTENT_REQUIREMENTS[lesson.contentType];
  if (requirement.body) {
    return lesson.body && lesson.body.trim().length > 0 ? null : `Needs ${requirement.description}`;
  }
  return lesson.resources.some((resource) => requirement.resourceTypes.includes(resource.type))
    ? null
    : `Needs ${requirement.description}`;
}

export type ModuleCreateInput = z.infer<typeof moduleCreateSchema>;
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;
export type ChapterCreateInput = z.infer<typeof chapterCreateSchema>;
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;
export type LessonCreateInput = z.infer<typeof lessonCreateSchema>;
export type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
