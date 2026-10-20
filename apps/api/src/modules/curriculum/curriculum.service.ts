import type { ChapterDto, CurriculumTreeDto, LessonDto, ModuleDto, ResourceDto } from '@asra/types';
import {
  resourceLocationIssue,
  type ChapterCreateInput,
  type ChapterUpdateInput,
  type LessonCreateInput,
  type LessonUpdateInput,
  type ModuleCreateInput,
  type ModuleUpdateInput,
  type ReorderInput,
  type ResourceInput,
  type ResourceLocation,
  type ResourceUpdateInput,
} from '@asra/validation';
import { CONFIGURED_STORAGE_PROVIDERS } from '../../config/storage.js';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { coursePublicationGuard } from '../courses/courses.service.js';
import { dispatchAfterCommit } from '../notifications/dispatcher.js';
import { notificationProducers } from '../notifications/producers.js';
import {
  createCurriculumRepository,
  type ChapterRow,
  type LessonRow,
  type ModuleRow,
  type ResourceRow,
} from './curriculum.repository.js';

/**
 * Curriculum & lesson content (FR-ADM-009, FR-ACA-004, FR-CNT-001/002).
 *
 * Every operation:
 *   1. resolves the owning course from the DATABASE (target id → parent chain), never from the
 *      URL or body, so ids from another course/chapter cannot be smuggled in (IDOR);
 *   2. checks `accessPolicy.assertCanManageCourseContent` for that course (route middleware has
 *      already required `content.manage`);
 *   3. row-locks the course, so concurrent edits and reorders are serialised;
 *   4. re-checks publication eligibility when the course is PUBLISHED (rolls back otherwise).
 *
 * Deletion never cascades silently through structure: a module/chapter must be empty first.
 * Deleting a lesson removes its resource references (never files — none are stored).
 */

// --- Mappers --------------------------------------------------------------------------------

function toLocation(row: ResourceRow): ResourceDto['location'] {
  return row.externalUrl !== null
    ? { kind: 'external', externalUrl: row.externalUrl }
    : {
        kind: 'storage',
        storageProvider: row.storageProvider ?? '',
        storageKey: row.storageKey ?? '',
      };
}

export function toResourceDto(row: ResourceRow): ResourceDto {
  return {
    id: row.id,
    lessonId: row.lessonId,
    title: row.title,
    type: row.type,
    location: toLocation(row),
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLessonDto(row: LessonRow): LessonDto {
  return {
    id: row.id,
    chapterId: row.chapterId,
    title: row.title,
    description: row.description,
    contentType: row.contentType,
    body: row.body,
    status: row.status,
    position: row.position,
    durationSeconds: row.durationSeconds,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resources: row.resources.map(toResourceDto),
  };
}

export function toChapterDto(row: ChapterRow): ChapterDto {
  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    description: row.description,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lessons: row.lessons.map(toLessonDto),
  };
}

export function toModuleDto(row: ModuleRow): ModuleDto {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    chapters: row.chapters.map(toChapterDto),
  };
}

// --- Helpers --------------------------------------------------------------------------------

const notFound = (entity: string): never => {
  throw new AppError('NOT_FOUND', `${entity} not found`);
};

type Repo = ReturnType<typeof createCurriculumRepository>;

/**
 * Runs `work` in a transaction after the access check and the course lock, then applies the
 * published-course guard. `courseId` must come from the database.
 */
async function mutate<T>(
  auth: AuthContext,
  courseId: string,
  work: (repo: Repo, tx: DbClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await accessPolicy.assertCanManageCourseContent(auth, courseId, tx);
    const repo = createCurriculumRepository(tx);
    if (!(await repo.lockCourse(courseId))) notFound('Course');
    const result = await work(repo, tx);
    await coursePublicationGuard.assertStillPublishable(tx, courseId);
    return result;
  });
}

/** 404 unless the course exists (checked before the access policy, like every other lookup). */
async function requireCourse(courseId: string) {
  return (await createCurriculumRepository(prisma).findCourse(courseId)) ?? notFound('Course');
}

async function assertCanRead(auth: AuthContext, courseId: string): Promise<void> {
  await accessPolicy.assertCanManageCourseContent(auth, courseId);
}

/** The reorder list must be exactly the current children — no strangers, no omissions. */
async function assertSameSet(currentIds: string[], input: ReorderInput, label: string) {
  const current = new Set(currentIds);
  if (
    input.orderedIds.length !== current.size ||
    !input.orderedIds.every((id) => current.has(id))
  ) {
    throw fieldError(
      'VALIDATION_ERROR',
      'orderedIds',
      `List every ${label} of this parent exactly once. Reload and try again.`,
    );
  }
}

/** Stored-object references are refused until a storage provider exists (R-01, G-01). */
function assertLocationSupported(location: ResourceLocation): void {
  if (location.kind === 'storage' && !CONFIGURED_STORAGE_PROVIDERS.has(location.storageProvider)) {
    throw fieldError(
      'VALIDATION_ERROR',
      'location',
      'File storage is not configured yet. Use an external https:// link for now.',
    );
  }
}

function locationColumns(location: ResourceLocation) {
  return location.kind === 'external'
    ? { externalUrl: location.externalUrl, storageProvider: null, storageKey: null }
    : {
        externalUrl: null,
        storageProvider: location.storageProvider,
        storageKey: location.storageKey,
      };
}

/**
 * Removes a lesson's assignment settings, refusing (409) while students have submitted work for
 * it: submissions are records of student work and are never deleted by a curriculum edit
 * (FK `assignment_submissions → assignments` is RESTRICT as a second line of defence).
 */
async function releaseAssignmentSettings(
  tx: DbClient,
  lessonId: string,
  action: 'delete' | 'change the type of',
): Promise<void> {
  const assignment = await tx.assignment.findUnique({
    where: { lessonId },
    select: { id: true, _count: { select: { submissions: true } } },
  });
  if (!assignment) return;
  if (assignment._count.submissions > 0) {
    throw new AppError(
      'CONFLICT',
      `Students have submitted work for this assignment, so you cannot ${action} this lesson. Unpublish it instead.`,
    );
  }
  await tx.assignment.delete({ where: { id: assignment.id } });
}

/**
 * Removes a QUIZ lesson's online quiz (questions included), refusing (409) once any student has
 * attempted it: attempts and results are student records (PHASE 09; FK
 * `assessment_attempts → quizzes` is RESTRICT as a second line of defence).
 */
async function releaseQuiz(
  tx: DbClient,
  lessonId: string,
  action: 'delete' | 'change the type of',
): Promise<void> {
  const quiz = await tx.quiz.findUnique({
    where: { lessonId },
    select: { id: true, _count: { select: { attempts: true } } },
  });
  if (!quiz) return;
  if (quiz._count.attempts > 0) {
    throw new AppError(
      'CONFLICT',
      `Students have attempted this quiz, so you cannot ${action} this lesson. Unpublish it or close the quiz instead.`,
    );
  }
  await tx.quiz.delete({ where: { id: quiz.id } });
}

/** `publishedAt` follows `status` (CHECK lessons_published_at_required). */
function lessonStatusColumns(status: 'DRAFT' | 'PUBLISHED' | undefined, previous?: string) {
  if (status === undefined || status === previous) return {};
  return status === 'PUBLISHED'
    ? { status, publishedAt: new Date() }
    : { status, publishedAt: null };
}

// --- Service --------------------------------------------------------------------------------

export const curriculumService = {
  async tree(auth: AuthContext, courseId: string): Promise<CurriculumTreeDto> {
    const course = await requireCourse(courseId);
    await assertCanRead(auth, courseId);
    const modules = await createCurriculumRepository(prisma).tree(courseId);
    return { courseId, courseStatus: course.status, modules: modules.map(toModuleDto) };
  },

  // Modules -----------------------------------------------------------------------------------

  async listModules(auth: AuthContext, courseId: string): Promise<ModuleDto[]> {
    await requireCourse(courseId);
    await assertCanRead(auth, courseId);
    return (await createCurriculumRepository(prisma).modules.list(courseId)).map(toModuleDto);
  },

  async createModule(
    auth: AuthContext,
    courseId: string,
    input: ModuleCreateInput,
  ): Promise<ModuleDto> {
    await requireCourse(courseId);
    return mutate(auth, courseId, async (repo) =>
      toModuleDto(await repo.modules.create(courseId, input)),
    );
  },

  async updateModule(auth: AuthContext, id: string, input: ModuleUpdateInput): Promise<ModuleDto> {
    const owner = (await createCurriculumRepository(prisma).moduleOwner(id)) ?? notFound('Module');
    return mutate(auth, owner.courseId, async (repo) =>
      toModuleDto(await repo.modules.update(id, withoutUndefined(input))),
    );
  },

  async deleteModule(auth: AuthContext, id: string): Promise<void> {
    const owner = (await createCurriculumRepository(prisma).moduleOwner(id)) ?? notFound('Module');
    await mutate(auth, owner.courseId, async (repo) => {
      if ((await repo.modules.childCount(id)) > 0) {
        throw new AppError(
          'CONFLICT',
          'This module still has chapters. Delete or empty them first.',
        );
      }
      await repo.modules.delete(id);
    });
  },

  async reorderModules(
    auth: AuthContext,
    courseId: string,
    input: ReorderInput,
  ): Promise<ModuleDto[]> {
    await requireCourse(courseId);
    return mutate(auth, courseId, async (repo) => {
      await assertSameSet(await repo.modules.siblingIds(courseId), input, 'module');
      await repo.modules.reorder(input.orderedIds);
      return (await repo.modules.list(courseId)).map(toModuleDto);
    });
  },

  // Chapters ----------------------------------------------------------------------------------

  async listChapters(auth: AuthContext, moduleId: string): Promise<ChapterDto[]> {
    const repo = createCurriculumRepository(prisma);
    const owner = (await repo.moduleOwner(moduleId)) ?? notFound('Module');
    await assertCanRead(auth, owner.courseId);
    return (await repo.chapters.list(moduleId)).map(toChapterDto);
  },

  async createChapter(
    auth: AuthContext,
    moduleId: string,
    input: ChapterCreateInput,
  ): Promise<ChapterDto> {
    const owner =
      (await createCurriculumRepository(prisma).moduleOwner(moduleId)) ?? notFound('Module');
    return mutate(auth, owner.courseId, async (repo) =>
      toChapterDto(await repo.chapters.create(moduleId, input)),
    );
  },

  async updateChapter(
    auth: AuthContext,
    id: string,
    input: ChapterUpdateInput,
  ): Promise<ChapterDto> {
    const owner =
      (await createCurriculumRepository(prisma).chapterOwner(id)) ?? notFound('Chapter');
    return mutate(auth, owner.module.courseId, async (repo) =>
      toChapterDto(await repo.chapters.update(id, withoutUndefined(input))),
    );
  },

  async deleteChapter(auth: AuthContext, id: string): Promise<void> {
    const owner =
      (await createCurriculumRepository(prisma).chapterOwner(id)) ?? notFound('Chapter');
    await mutate(auth, owner.module.courseId, async (repo) => {
      if ((await repo.chapters.childCount(id)) > 0) {
        throw new AppError('CONFLICT', 'This chapter still has lessons. Delete them first.');
      }
      await repo.chapters.delete(id);
    });
  },

  async reorderChapters(
    auth: AuthContext,
    moduleId: string,
    input: ReorderInput,
  ): Promise<ChapterDto[]> {
    const owner =
      (await createCurriculumRepository(prisma).moduleOwner(moduleId)) ?? notFound('Module');
    return mutate(auth, owner.courseId, async (repo) => {
      await assertSameSet(await repo.chapters.siblingIds(moduleId), input, 'chapter');
      await repo.chapters.reorder(input.orderedIds);
      return (await repo.chapters.list(moduleId)).map(toChapterDto);
    });
  },

  // Lessons -----------------------------------------------------------------------------------

  async listLessons(auth: AuthContext, chapterId: string): Promise<LessonDto[]> {
    const repo = createCurriculumRepository(prisma);
    const owner = (await repo.chapterOwner(chapterId)) ?? notFound('Chapter');
    await assertCanRead(auth, owner.module.courseId);
    return (await repo.lessons.list(chapterId)).map(toLessonDto);
  },

  async getLesson(auth: AuthContext, id: string): Promise<LessonDto> {
    const repo = createCurriculumRepository(prisma);
    const owner = (await repo.lessonOwner(id)) ?? notFound('Lesson');
    await assertCanRead(auth, owner.chapter.module.courseId);
    return toLessonDto((await repo.lessons.find(id)) ?? notFound('Lesson'));
  },

  async createLesson(
    auth: AuthContext,
    chapterId: string,
    input: LessonCreateInput,
  ): Promise<LessonDto> {
    const owner =
      (await createCurriculumRepository(prisma).chapterOwner(chapterId)) ?? notFound('Chapter');
    const { status, ...fields } = input;
    let deliveries: string[] = [];
    const lesson = await mutate(auth, owner.module.courseId, async (repo, tx) => {
      const created = await repo.lessons.create(chapterId, {
        ...withoutUndefined(fields),
        title: fields.title,
        contentType: fields.contentType,
        status: 'DRAFT',
        ...lessonStatusColumns(status, 'DRAFT'),
      });
      // PHASE 11: a published assignment in a published course → students are notified.
      if (created.contentType === 'ASSIGNMENT' && created.status === 'PUBLISHED') {
        deliveries = await notificationProducers.assignmentPublished(tx, created.id);
      }
      return toLessonDto(created);
    });
    dispatchAfterCommit(deliveries);
    return lesson;
  },

  async updateLesson(auth: AuthContext, id: string, input: LessonUpdateInput): Promise<LessonDto> {
    const owner = (await createCurriculumRepository(prisma).lessonOwner(id)) ?? notFound('Lesson');
    const { status, ...fields } = input;
    let deliveries: string[] = [];
    const lesson = await mutate(auth, owner.chapter.module.courseId, async (repo, tx) => {
      // An assignment that stops being an assignment loses its submission settings — never its
      // students' work (PHASE 08).
      if (
        owner.contentType === 'ASSIGNMENT' &&
        fields.contentType !== undefined &&
        fields.contentType !== 'ASSIGNMENT'
      ) {
        await releaseAssignmentSettings(tx, id, 'change the type of');
      }
      if (
        owner.contentType === 'QUIZ' &&
        fields.contentType !== undefined &&
        fields.contentType !== 'QUIZ'
      ) {
        await releaseQuiz(tx, id, 'change the type of');
      }
      const updated = await repo.lessons.update(id, {
        ...withoutUndefined(fields),
        ...lessonStatusColumns(status, owner.status),
      });
      // PHASE 11: the lesson has just become a published assignment (deduped per lesson).
      if (
        updated.contentType === 'ASSIGNMENT' &&
        updated.status === 'PUBLISHED' &&
        (owner.status !== 'PUBLISHED' || owner.contentType !== 'ASSIGNMENT')
      ) {
        deliveries = await notificationProducers.assignmentPublished(tx, id);
      }
      return toLessonDto(updated);
    });
    dispatchAfterCommit(deliveries);
    return lesson;
  },

  async deleteLesson(auth: AuthContext, id: string): Promise<void> {
    const owner = (await createCurriculumRepository(prisma).lessonOwner(id)) ?? notFound('Lesson');
    await mutate(auth, owner.chapter.module.courseId, async (repo, tx) => {
      await releaseAssignmentSettings(tx, id, 'delete');
      await releaseQuiz(tx, id, 'delete');
      await repo.lessons.delete(id);
    });
  },

  async reorderLessons(
    auth: AuthContext,
    chapterId: string,
    input: ReorderInput,
  ): Promise<LessonDto[]> {
    const owner =
      (await createCurriculumRepository(prisma).chapterOwner(chapterId)) ?? notFound('Chapter');
    return mutate(auth, owner.module.courseId, async (repo) => {
      await assertSameSet(await repo.lessons.siblingIds(chapterId), input, 'lesson');
      await repo.lessons.reorder(input.orderedIds);
      return (await repo.lessons.list(chapterId)).map(toLessonDto);
    });
  },

  // Resources ---------------------------------------------------------------------------------

  async listResources(auth: AuthContext, lessonId: string): Promise<ResourceDto[]> {
    const repo = createCurriculumRepository(prisma);
    const owner = (await repo.lessonOwner(lessonId)) ?? notFound('Lesson');
    await assertCanRead(auth, owner.chapter.module.courseId);
    return (await repo.resources.list(lessonId)).map(toResourceDto);
  },

  async createResource(
    auth: AuthContext,
    lessonId: string,
    input: ResourceInput,
  ): Promise<ResourceDto> {
    const owner =
      (await createCurriculumRepository(prisma).lessonOwner(lessonId)) ?? notFound('Lesson');
    assertLocationSupported(input.location);
    const { location, ...fields } = input;
    return mutate(auth, owner.chapter.module.courseId, async (repo) =>
      toResourceDto(
        await repo.resources.create(lessonId, {
          ...withoutUndefined(fields),
          title: fields.title,
          type: fields.type,
          ...locationColumns(location),
        }),
      ),
    );
  },

  async updateResource(
    auth: AuthContext,
    id: string,
    input: ResourceUpdateInput,
  ): Promise<ResourceDto> {
    const owner =
      (await createCurriculumRepository(prisma).resourceOwner(id)) ?? notFound('Resource');
    const { location, ...fields } = input;
    if (location) assertLocationSupported(location);

    // Validate the FINAL type/location pair (mirrors resources_external_link_has_url).
    const finalLocation: ResourceLocation =
      location ??
      (owner.externalUrl !== null
        ? { kind: 'external', externalUrl: owner.externalUrl }
        : {
            kind: 'storage',
            storageProvider: owner.storageProvider ?? '',
            storageKey: owner.storageKey ?? '',
          });
    const issue = resourceLocationIssue(fields.type ?? owner.type, finalLocation);
    if (issue) throw fieldError('VALIDATION_ERROR', 'location', issue);

    const data: Prisma.ResourceUncheckedUpdateInput = {
      ...withoutUndefined(fields),
      ...(location ? locationColumns(location) : {}),
    };
    return mutate(auth, owner.lesson.chapter.module.courseId, async (repo) =>
      toResourceDto(await repo.resources.update(id, data)),
    );
  },

  async deleteResource(auth: AuthContext, id: string): Promise<void> {
    const owner =
      (await createCurriculumRepository(prisma).resourceOwner(id)) ?? notFound('Resource');
    await mutate(auth, owner.lesson.chapter.module.courseId, (repo) => repo.resources.delete(id));
  },

  async reorderResources(
    auth: AuthContext,
    lessonId: string,
    input: ReorderInput,
  ): Promise<ResourceDto[]> {
    const owner =
      (await createCurriculumRepository(prisma).lessonOwner(lessonId)) ?? notFound('Lesson');
    return mutate(auth, owner.chapter.module.courseId, async (repo) => {
      await assertSameSet(await repo.resources.siblingIds(lessonId), input, 'resource');
      await repo.resources.reorder(input.orderedIds);
      return (await repo.resources.list(lessonId)).map(toResourceDto);
    });
  },
};
