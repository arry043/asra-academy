import type {
  LessonContentType,
  PublicInstructor,
  PublicModuleOutline,
  PublicRef,
  ResourceKind,
} from './catalog.js';

/**
 * Response shapes of the PHASE 07 student LMS endpoints (`/api/v1/student/*`) and the admin
 * enrolment endpoints (docs/STUDENT-LMS.md). Timestamps are ISO-8601 strings (JSON).
 * Every student payload is scoped to the signed-in student — none of these types ever carries
 * another student's data.
 */

export type EnrollmentStatus = 'ACTIVE' | 'CANCELLED';
/** FREE = self-enrolment on a course priced at 0; ADMIN = enrolled by the academy. */
export type EnrollmentSource = 'FREE' | 'ADMIN';

/**
 * How the signed-in student can reach a course's content.
 * - ENROLLED: an ACTIVE enrolment exists.
 * - FREE_ENROLMENT: the course is explicitly free (price 0); the student may enrol themselves.
 * - CONTACT_ACADEMY: paid, price not set, or enrolment cancelled — the academy enrols the student
 *   (online payment is not available yet, PHASE 10).
 */
export type CourseAccessState = 'ENROLLED' | 'FREE_ENROLMENT' | 'CONTACT_ACADEMY';

/**
 * Course completion derived from lesson-progress records (docs/STUDENT-LMS.md §4).
 * `percent` is null when the course has no eligible lessons (never a fabricated 0 or 100).
 */
export interface CourseProgressDto {
  completedLessons: number;
  totalLessons: number;
  percent: number | null;
  /** First time every eligible lesson was complete. */
  completedAt: string | null;
}

export interface StudentCourseRef {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  category: PublicRef | null;
  class: PublicRef | null;
  stream: PublicRef | null;
  subject: PublicRef | null;
}

/** Where a lesson sits in the course hierarchy. */
export interface LessonLocator {
  lessonId: string;
  lessonTitle: string;
  contentType: LessonContentType;
  chapterTitle: string;
  moduleTitle: string;
}

export interface StudentEnrollmentSummary {
  id: string;
  status: EnrollmentStatus;
  source: EnrollmentSource;
  enrolledAt: string;
  cancelledAt: string | null;
  lastActivityAt: string | null;
}

/** A course the student is enrolled in, with progress and the lesson to resume. */
export interface StudentCourseCard extends StudentCourseRef {
  enrollment: StudentEnrollmentSummary;
  progress: CourseProgressDto;
  /** The last valid lesson, else the first accessible lesson; null if nothing is published. */
  resumeLesson: LessonLocator | null;
}

export interface ContinueLearningItem {
  course: StudentCourseRef;
  lesson: LessonLocator;
  progress: CourseProgressDto;
  lastActivityAt: string;
}

/** Availability of a capability that depends on a later phase or a pending client decision. */
export interface FeatureStatus {
  available: boolean;
  /** Student-facing explanation shown in the empty/unavailable state. */
  message: string;
}

export interface StudentFeatures {
  liveClasses: FeatureStatus;
  quizAttempts: FeatureStatus;
  assignmentSubmissions: FeatureStatus;
  exams: FeatureStatus;
  results: FeatureStatus;
  certificates: FeatureStatus;
  payments: FeatureStatus;
}

export interface StudentDashboardDto {
  student: { fullName: string };
  stats: {
    activeCourses: number;
    completedCourses: number;
    completedLessons: number;
  };
  continueLearning: ContinueLearningItem[];
  /** First page of active enrolments, most recently active first. */
  courses: StudentCourseCard[];
  totalCourses: number;
  /** Quiz and assignment lessons of enrolled courses (instructions only until PHASE 09). */
  /** `exams` = published exams that are open or upcoming in accessible courses. */
  assessments: { quizzes: number; assignments: number; exams: number };
  /** Courses whose every eligible lesson is complete (no certificate is implied). */
  completedCourses: { course: StudentCourseRef; completedAt: string }[];
  features: StudentFeatures;
}

// --- Catalogue for enrolment ----------------------------------------------------------------

export interface StudentCatalogCourse extends StudentCourseRef {
  summary: string | null;
  durationMinutes: number | null;
  instructors: PublicInstructor[];
  access: CourseAccessState;
}

// --- Course overview, curriculum and player -------------------------------------------------

export interface StudentCurriculumLesson {
  id: string;
  title: string;
  contentType: LessonContentType;
  durationSeconds: number | null;
  resourceCount: number;
  /** QUIZ and ASSIGNMENT lessons do not count towards progress until PHASE 09. */
  countsTowardProgress: boolean;
  completedAt: string | null;
}

export interface StudentCurriculumChapter {
  id: string;
  title: string;
  description: string | null;
  lessons: StudentCurriculumLesson[];
}

export interface StudentCurriculumModule {
  id: string;
  title: string;
  description: string | null;
  chapters: StudentCurriculumChapter[];
}

export interface StudentCurriculumDto {
  courseId: string;
  modules: StudentCurriculumModule[];
  progress: CourseProgressDto;
  resumeLessonId: string | null;
}

export interface StudentCourseOverview extends StudentCourseRef {
  summary: string | null;
  description: string | null;
  durationMinutes: number | null;
  instructors: PublicInstructor[];
  access: CourseAccessState;
  enrollment: StudentEnrollmentSummary | null;
  /** Titles of published lessons — shown before enrolment. */
  outline: PublicModuleOutline[];
  lessonCount: number;
  /** Only for enrolled students. */
  curriculum: StudentCurriculumDto | null;
  resumeLesson: LessonLocator | null;
}

/**
 * How the browser may open a resource. Only validated HTTPS links are ever returned; stored
 * objects are reported as unavailable until a storage provider exists (R-01, G-01).
 */
export type StudentResourceAccess =
  { kind: 'external'; url: string } | { kind: 'unavailable'; reason: string };

export interface StudentResourceDto {
  id: string;
  title: string;
  type: ResourceKind;
  mimeType: string | null;
  sizeBytes: number | null;
  access: StudentResourceAccess;
}

export interface LessonProgressDto {
  firstViewedAt: string;
  lastViewedAt: string;
  completedAt: string | null;
  videoPositionSeconds: number | null;
  videoWatchedSeconds: number;
  /** Server-verified: credited playback reached the threshold of the configured duration. */
  videoCompletedAt: string | null;
}

export interface LessonNavTarget {
  id: string;
  title: string;
  contentType: LessonContentType;
}

export interface StudentLessonDto {
  id: string;
  title: string;
  description: string | null;
  contentType: LessonContentType;
  /** Plain text/markdown written by staff — rendered as text, never as HTML. */
  body: string | null;
  durationSeconds: number | null;
  course: { id: string; title: string };
  module: { id: string; title: string };
  chapter: { id: string; title: string };
  resources: StudentResourceDto[];
  progress: LessonProgressDto | null;
  countsTowardProgress: boolean;
  navigation: {
    previous: LessonNavTarget | null;
    next: LessonNavTarget | null;
    /** 1-based position among the course's accessible lessons. */
    position: number;
    total: number;
  };
}

/** Result of completing/reopening a lesson or recording activity. */
export interface LessonProgressUpdateDto {
  lessonId: string;
  progress: LessonProgressDto;
  course: CourseProgressDto;
}

// --- Lists ----------------------------------------------------------------------------------

/** A lesson of an enrolled course, e.g. a quiz or assignment placeholder or a recorded lecture. */
export interface StudentLessonListItem {
  course: StudentCourseRef;
  lesson: LessonLocator;
  durationSeconds: number | null;
  completedAt: string | null;
}

export interface LearningHistoryItem {
  course: StudentCourseRef;
  lesson: LessonLocator;
  firstViewedAt: string;
  lastViewedAt: string;
  completedAt: string | null;
}

export interface StudentEnrollmentRecord {
  course: StudentCourseRef;
  enrollment: StudentEnrollmentSummary;
  completedAt: string | null;
}

// --- Profile --------------------------------------------------------------------------------

export interface StudentProfileDto {
  fullName: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  memberSince: string;
  studentCode: string | null;
  academicLevel: PublicRef | null;
  class: PublicRef | null;
  stream: PublicRef | null;
}

// --- Administration -------------------------------------------------------------------------

export interface AdminEnrollmentDto {
  id: string;
  courseId: string;
  student: { userId: string; fullName: string; email: string };
  status: EnrollmentStatus;
  source: EnrollmentSource;
  enrolledBy: string | null;
  enrolledAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  progress: CourseProgressDto;
}
