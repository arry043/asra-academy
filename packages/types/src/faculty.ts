import type { CourseVisibility, PublicationStatus, PublicRef } from './catalog.js';
import type {
  CourseProgressDto,
  FeatureStatus,
  LessonLocator,
  StudentCourseRef,
} from './student.js';

/**
 * Response shapes of the PHASE 08 faculty portal (`/api/v1/faculty/*`) and the assignment /
 * live-class additions to the student portal (docs/FACULTY-PORTAL.md). Timestamps are ISO-8601.
 * Faculty payloads only ever contain courses the signed-in faculty member is assigned to, and
 * students enrolled in those courses — never contact details (C-04 assumption).
 */

// --- Shared ---------------------------------------------------------------------------------

export type SubmissionStatus = 'SUBMITTED' | 'GRADED';
export type LiveClassStatus = 'SCHEDULED' | 'CANCELLED';

/** A course as listed in the faculty portal (any publication status). */
export interface FacultyCourseRef extends StudentCourseRef {
  status: PublicationStatus;
  visibility: CourseVisibility;
}

export interface FacultyCourseCard extends FacultyCourseRef {
  /** This faculty member is the course's primary instructor. */
  isPrimary: boolean;
  activeStudents: number;
  lessons: { published: number; draft: number };
  assignments: number;
  pendingReviews: number;
  upcomingClasses: number;
  updatedAt: string;
}

/** What the platform cannot do yet, reported so the portal never shows fake data. */
export interface FacultyFeatures {
  /** A provider that creates meetings automatically (F-01). Manual links work without it. */
  liveClassProvider: FeatureStatus;
  /** Uploading video/PDF files (R-01, G-01). External https:// links work without it. */
  fileUploads: FeatureStatus;
  quizzes: FeatureStatus;
  exams: FeatureStatus;
}

// --- Dashboard ------------------------------------------------------------------------------

export interface FacultyDashboardDto {
  faculty: { fullName: string; designation: string | null };
  stats: {
    courses: number;
    activeStudents: number;
    assignments: number;
    pendingReviews: number;
    gradedUnreleased: number;
    upcomingClasses: number;
    quizLessons: number;
  };
  courses: FacultyCourseCard[];
  upcomingClasses: LiveClassDto[];
  pendingSubmissions: SubmissionListItem[];
  features: FacultyFeatures;
}

// --- Course workspace -----------------------------------------------------------------------

export interface FacultyColleague {
  fullName: string;
  designation: string | null;
  isPrimary: boolean;
  /** True for the signed-in faculty member. */
  isYou: boolean;
}

export interface FacultyCourseDetail extends FacultyCourseCard {
  summary: string | null;
  description: string | null;
  durationMinutes: number | null;
  instructors: FacultyColleague[];
  modules: number;
  chapters: number;
  quizLessons: number;
}

// --- Students & performance -----------------------------------------------------------------

/** Assignment work of one student in one course (published assignments only). */
export interface StudentWorkSummary {
  assignments: number;
  submitted: number;
  graded: number;
  released: number;
  /** Sum of released marks ÷ sum of their maximum marks, floored %; null without releases. */
  releasedScorePercent: number | null;
}

/** One enrolled student in one assigned course — teaching data only, no contact details. */
export interface FacultyStudentRow {
  enrollmentId: string;
  student: { userId: string; fullName: string; class: PublicRef | null; stream: PublicRef | null };
  course: { id: string; title: string };
  enrolledAt: string;
  lastActivityAt: string | null;
  completedAt: string | null;
  progress: CourseProgressDto;
  work: StudentWorkSummary;
}

/** Lower bounds of the progress buckets; `none` = the course has no countable lessons. */
export interface ProgressDistribution {
  none: number;
  '0': number;
  '1-24': number;
  '25-49': number;
  '50-74': number;
  '75-99': number;
  '100': number;
}

export interface CoursePerformanceDto {
  course: FacultyCourseRef;
  /** Definitions: docs/FACULTY-PORTAL.md §7. */
  metrics: {
    activeStudents: number;
    countableLessons: number;
    /** Mean of the students' percentages; null without students or countable lessons. */
    averageProgressPercent: number | null;
    completedStudents: number;
    /** Students with learning activity in the last 7 days. */
    activeLast7Days: number;
    distribution: ProgressDistribution;
    publishedAssignments: number;
    submissions: number;
    pendingReviews: number;
    gradedUnreleased: number;
    released: number;
    /** Submissions ÷ (published assignments × active students), floored %; null if 0 × 0. */
    submissionRatePercent: number | null;
    /** Released marks ÷ their maximum marks across the course, floored %; null without releases. */
    releasedScorePercent: number | null;
  };
}

// --- Assignments & submissions --------------------------------------------------------------

export interface AssignmentSettingsDto {
  id: string;
  maxMarks: number;
  dueAt: string | null;
  updatedAt: string;
}

/** An ASSIGNMENT lesson of an assigned course; `settings` is null until submissions are set up. */
export interface FacultyAssignmentItem {
  lessonId: string;
  title: string;
  status: PublicationStatus;
  course: { id: string; title: string };
  module: { id: string; title: string };
  chapter: { id: string; title: string };
  settings: AssignmentSettingsDto | null;
  counts: { submitted: number; graded: number; released: number };
  updatedAt: string;
}

export interface FacultyAssignmentDetail extends FacultyAssignmentItem {
  instructions: string | null;
  description: string | null;
  resourceCount: number;
  activeStudents: number;
}

export interface SubmissionListItem {
  id: string;
  student: { userId: string; fullName: string };
  assignment: {
    id: string;
    lessonId: string;
    title: string;
    maxMarks: number;
    dueAt: string | null;
  };
  course: { id: string; title: string };
  submittedAt: string;
  /** Submitted after the due date (informational; no penalty is applied, I-02). */
  late: boolean;
  status: SubmissionStatus;
  marksAwarded: number | null;
  gradedAt: string | null;
  resultReleasedAt: string | null;
}

export interface SubmissionDetailDto extends SubmissionListItem {
  /** Plain text written by the student — render as text, never HTML. */
  body: string;
  /** Re-validated https:// link, or null. */
  attachmentUrl: string | null;
  feedback: string | null;
  gradedBy: string | null;
  updatedAt: string;
}

// --- Live classes ---------------------------------------------------------------------------

export interface LiveClassDto {
  id: string;
  course: { id: string; title: string };
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: LiveClassStatus;
  /** "manual" when faculty entered the link; null when there is no link. */
  provider: string | null;
  /** Only returned to the course's faculty and enrolled students. */
  joinUrl: string | null;
  host: string | null;
  cancelledAt: string | null;
  updatedAt: string;
}

// --- Lessons by type (quizzes) ---------------------------------------------------------------

export interface FacultyLessonListItem {
  course: { id: string; title: string };
  lesson: LessonLocator;
  status: PublicationStatus;
  updatedAt: string;
}

// --- Profile --------------------------------------------------------------------------------

export interface FacultyProfileDto {
  fullName: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  designation: string | null;
  bio: string | null;
  qualifications: string | null;
  specialization: string | null;
  experienceYears: number | null;
  isPublic: boolean;
  memberSince: string;
  /** Allocation is derived from course assignments made by administrators. */
  subjects: PublicRef[];
  courses: { id: string; title: string; status: PublicationStatus; isPrimary: boolean }[];
}

// --- Student side ---------------------------------------------------------------------------

/** The signed-in student's own submission. Marks and feedback appear only once released. */
export interface StudentSubmissionDto {
  id: string;
  body: string;
  attachmentUrl: string | null;
  submittedAt: string;
  late: boolean;
  /** SUBMITTED until a result is released, so an unreleased grade is not disclosed. */
  state: 'SUBMITTED' | 'RESULT_RELEASED';
  result: {
    marksAwarded: number;
    maxMarks: number;
    feedback: string | null;
    releasedAt: string;
  } | null;
}

export interface StudentAssignmentDto {
  lessonId: string;
  /** False when faculty have not set up online submission for this assignment. */
  acceptingSubmissions: boolean;
  maxMarks: number | null;
  dueAt: string | null;
  submission: StudentSubmissionDto | null;
}

export interface StudentResultItem {
  submissionId: string;
  course: { id: string; title: string };
  lesson: LessonLocator;
  marksAwarded: number;
  maxMarks: number;
  feedback: string | null;
  submittedAt: string;
  releasedAt: string;
}
