import type {
  CourseAccessState,
  LessonContentType,
  LessonLocator,
  LessonProgressDto,
  PublicInstructor,
  PublicModuleOutline,
  StudentCourseRef,
  StudentCurriculumModule,
  StudentEnrollmentSummary,
  StudentFeatures,
  StudentResourceDto,
} from '@asra/types';
import { safeExternalUrlSchema } from '@asra/validation';
import type {
  CourseRefRow,
  EnrollmentRow,
  LessonWithOwnerRow,
  ProgressRow,
  StructureModuleRow,
} from './student.repository.js';
import { countsTowardProgress } from './progress.js';

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => date?.toISOString() ?? null;

export function toCourseRef(row: CourseRefRow): StudentCourseRef {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    thumbnailUrl: row.thumbnailUrl,
    category: row.category,
    class: row.class,
    stream: row.stream,
    subject: row.subject,
  };
}

export function toInstructors(
  rows: { facultyProfile: { designation: string | null; user: { fullName: string } } }[],
): PublicInstructor[] {
  return rows.map((item) => ({
    fullName: item.facultyProfile.user.fullName,
    designation: item.facultyProfile.designation,
  }));
}

export function toEnrollmentSummary(row: EnrollmentRow): StudentEnrollmentSummary {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    enrolledAt: iso(row.enrolledAt),
    cancelledAt: isoOrNull(row.cancelledAt),
    lastActivityAt: isoOrNull(row.lastActivityAt),
  };
}

export function toProgressDto(row: ProgressRow): LessonProgressDto {
  return {
    firstViewedAt: iso(row.firstViewedAt),
    lastViewedAt: iso(row.lastViewedAt),
    completedAt: isoOrNull(row.completedAt),
    videoPositionSeconds: row.videoPositionSeconds,
    videoWatchedSeconds: row.videoWatchedSeconds,
    videoCompletedAt: isoOrNull(row.videoCompletedAt),
  };
}

/**
 * How a student may open a resource. External URLs are re-validated on the way OUT with the same
 * schema used on the way in (HTTPS, public domain, no credentials), so a row written before the
 * PHASE 06 tightening — or edited directly in the database — can never reach the browser as a
 * `javascript:`/`http:` link. Stored objects are unavailable until a storage provider exists.
 */
export function toStudentResource(
  row: LessonWithOwnerRow['resources'][number],
): StudentResourceDto {
  const base = {
    id: row.id,
    title: row.title,
    type: row.type,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
  };
  if (row.externalUrl !== null) {
    const url = safeExternalUrlSchema.safeParse(row.externalUrl);
    return url.success
      ? { ...base, access: { kind: 'external', url: url.data } }
      : { ...base, access: { kind: 'unavailable', reason: 'This link is not available.' } };
  }
  return {
    ...base,
    access: {
      kind: 'unavailable',
      reason: 'File downloads are not available yet. Please ask your faculty for this material.',
    },
  };
}

// --- Curriculum -----------------------------------------------------------------------------

/** One published lesson with its place in the hierarchy, in CMS order. */
export interface FlatLesson {
  id: string;
  title: string;
  contentType: LessonContentType;
  durationSeconds: number | null;
  resourceCount: number;
  chapter: { id: string; title: string; description: string | null };
  module: { id: string; title: string; description: string | null };
}

export interface CourseView {
  modules: StructureModuleRow[];
  lessons: FlatLesson[];
  /** Ids of lessons that count towards progress. */
  eligibleIds: string[];
}

/** Flattens Module → Chapter → Lesson in the order configured by the academic CMS. */
export function toCourseView(modules: StructureModuleRow[] = []): CourseView {
  const lessons: FlatLesson[] = [];
  for (const module of modules) {
    for (const chapter of module.chapters) {
      for (const lesson of chapter.lessons) {
        lessons.push({
          id: lesson.id,
          title: lesson.title,
          contentType: lesson.contentType,
          durationSeconds: lesson.durationSeconds,
          resourceCount: lesson._count.resources,
          chapter: { id: chapter.id, title: chapter.title, description: chapter.description },
          module: { id: module.id, title: module.title, description: module.description },
        });
      }
    }
  }
  return {
    modules,
    lessons,
    eligibleIds: lessons.filter((l) => countsTowardProgress(l.contentType)).map((l) => l.id),
  };
}

export function toLocator(lesson: FlatLesson): LessonLocator {
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    contentType: lesson.contentType,
    chapterTitle: lesson.chapter.title,
    moduleTitle: lesson.module.title,
  };
}

/** The last valid lesson recorded for the student, else the first accessible lesson. */
export function resolveResumeLesson(
  view: CourseView,
  lastLessonId: string | null,
): FlatLesson | null {
  return (
    (lastLessonId ? view.lessons.find((lesson) => lesson.id === lastLessonId) : undefined) ??
    view.lessons[0] ??
    null
  );
}

/** Student curriculum: sections without published lessons are hidden, like the public outline. */
export function toStudentCurriculum(
  view: CourseView,
  completedAtByLesson: ReadonlyMap<string, Date | null>,
): StudentCurriculumModule[] {
  return view.modules
    .map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      chapters: module.chapters
        .filter((chapter) => chapter.lessons.length > 0)
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          lessons: chapter.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            contentType: lesson.contentType,
            durationSeconds: lesson.durationSeconds,
            resourceCount: lesson._count.resources,
            countsTowardProgress: countsTowardProgress(lesson.contentType),
            completedAt: isoOrNull(completedAtByLesson.get(lesson.id) ?? null),
          })),
        })),
    }))
    .filter((module) => module.chapters.length > 0);
}

export function toOutline(view: CourseView): PublicModuleOutline[] {
  return view.modules
    .map((module) => ({
      title: module.title,
      description: module.description,
      chapters: module.chapters
        .filter((chapter) => chapter.lessons.length > 0)
        .map((chapter) => ({
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => ({
            title: lesson.title,
            contentType: lesson.contentType,
            durationSeconds: lesson.durationSeconds,
          })),
        })),
    }))
    .filter((module) => module.chapters.length > 0);
}

/**
 * Access state shown to a student for a published course. Only an explicit price of 0 is free:
 * a missing price means "not configured", never "free" (B-04). A cancelled enrolment is not
 * reopened by the student (D-04).
 */
export function accessStateFor(
  course: { priceMinor: number | null },
  enrollment: { status: 'ACTIVE' | 'CANCELLED' } | null,
): CourseAccessState {
  if (enrollment?.status === 'ACTIVE') return 'ENROLLED';
  if (enrollment?.status === 'CANCELLED') return 'CONTACT_ACADEMY';
  return course.priceMinor === 0 ? 'FREE_ENROLMENT' : 'CONTACT_ACADEMY';
}

/**
 * Capabilities that depend on later phases or pending client decisions. Reported honestly so the
 * portal shows an unavailable state instead of fake records (docs/STUDENT-LMS.md §7).
 */
export const STUDENT_FEATURES: StudentFeatures = {
  liveClasses: {
    available: true,
    message:
      'Classes scheduled by your faculty appear here (times in IST). A joining link is shown when your faculty has added one.',
  },
  quizAttempts: {
    available: true,
    message:
      'Attempt the online quizzes in your quiz lessons. Scores, and when allowed the correct answers, appear after you submit or once your faculty publishes them.',
  },
  assignmentSubmissions: {
    available: true,
    message:
      'Submit your answer as text (and optionally a link) in each assignment lesson where your faculty has opened online submission.',
  },
  exams: {
    available: true,
    message:
      'Scheduled examinations of your courses appear here. The exam timer is kept by the server: your time runs from the moment you start, even if you close the page.',
  },
  results: {
    available: true,
    message:
      'Assignment marks and feedback, quiz scores and exam results appear here once they are released.',
  },
  certificates: {
    available: false,
    message:
      'Certificates are not issued online yet. Completed courses are listed here so you can track them.',
  },
  payments: {
    available: false,
    message:
      'Online payments are not enabled yet, so there is no payment history to show. Contact the academy about fees.',
  },
};
