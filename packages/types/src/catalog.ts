/**
 * Response shapes of the PHASE 06 academic, course and curriculum endpoints
 * (docs/COURSE-MANAGEMENT.md §6). Timestamps are ISO-8601 strings (JSON).
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

/** `data` of every paginated list endpoint. */
export interface Paginated<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CourseVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type LessonContentType =
  'VIDEO' | 'PDF' | 'DOCUMENT' | 'LINK' | 'QUIZ' | 'ASSIGNMENT' | 'TEXT';
export type ResourceKind =
  'VIDEO' | 'PDF' | 'DOCUMENT' | 'PRESENTATION' | 'IMAGE' | 'AUDIO' | 'EXTERNAL_LINK' | 'OTHER';

// --- Academic structure (admin) -------------------------------------------------------------

/** Compact reference to a catalogue row, e.g. a course's class. */
export interface CatalogueRef {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface CatalogueTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface AcademicLevelDto extends CatalogueTimestamps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  board: string | null;
  sortOrder: number;
  isActive: boolean;
  classCount: number;
  streamCount: number;
}

export interface ClassDto extends CatalogueTimestamps {
  id: string;
  academicLevelId: string;
  academicLevel: CatalogueRef;
  name: string;
  slug: string;
  gradeNumber: number | null;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
}

export interface StreamDto extends CatalogueTimestamps {
  id: string;
  academicLevelId: string;
  academicLevel: CatalogueRef;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
}

export interface SubjectDto extends CatalogueTimestamps {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  courseCount: number;
}

export interface CourseCategoryDto extends CatalogueTimestamps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
}

// --- Courses (admin) ------------------------------------------------------------------------

/** A faculty member who can be assigned to courses. */
export interface FacultyOptionDto {
  facultyProfileId: string;
  fullName: string;
  designation: string | null;
  employeeCode: string | null;
  /** The account is ACTIVE and still holds the FACULTY role. */
  assignable: boolean;
}

export interface CourseInstructorDto {
  facultyProfileId: string;
  fullName: string;
  designation: string | null;
  isPrimary: boolean;
  assignable: boolean;
}

/** One unmet publication requirement. `path` names the field or area to fix. */
export interface PublicationIssue {
  code: string;
  path: string[];
  message: string;
}

export interface PublicationCheck {
  eligible: boolean;
  issues: PublicationIssue[];
}

export interface AdminCourseListItem {
  id: string;
  title: string;
  slug: string;
  status: PublicationStatus;
  visibility: CourseVisibility;
  thumbnailUrl: string | null;
  category: CatalogueRef | null;
  class: CatalogueRef | null;
  stream: CatalogueRef | null;
  subject: CatalogueRef | null;
  instructors: CourseInstructorDto[];
  durationMinutes: number | null;
  priceMinor: number | null;
  currency: string | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumCounts {
  modules: number;
  chapters: number;
  lessons: number;
  publishedLessons: number;
  resources: number;
}

export interface AdminCourseDetail extends AdminCourseListItem {
  summary: string | null;
  description: string | null;
  counts: CurriculumCounts;
  publication: PublicationCheck;
}

// --- Curriculum (admin) ---------------------------------------------------------------------

export type ResourceLocationDto =
  | { kind: 'external'; externalUrl: string }
  | { kind: 'storage'; storageProvider: string; storageKey: string };

export interface ResourceDto {
  id: string;
  lessonId: string;
  title: string;
  type: ResourceKind;
  location: ResourceLocationDto;
  mimeType: string | null;
  sizeBytes: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonDto {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  contentType: LessonContentType;
  body: string | null;
  status: PublicationStatus;
  position: number;
  durationSeconds: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resources: ResourceDto[];
}

export interface ChapterDto {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  lessons: LessonDto[];
}

export interface ModuleDto {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  chapters: ChapterDto[];
}

export interface CurriculumTreeDto {
  courseId: string;
  courseStatus: PublicationStatus;
  modules: ModuleDto[];
}

// --- Public catalogue -----------------------------------------------------------------------

export interface PublicRef {
  name: string;
  slug: string;
}

/** Only faculty whose profile is public (FacultyProfile.isPublic, C-02) are listed. */
export interface PublicInstructor {
  fullName: string;
  designation: string | null;
}

export interface PublicCourseSummary {
  slug: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
  category: PublicRef | null;
  class: PublicRef | null;
  stream: PublicRef | null;
  subject: PublicRef | null;
  durationMinutes: number | null;
  instructors: PublicInstructor[];
  publishedAt: string;
}

export interface PublicLessonOutline {
  title: string;
  contentType: LessonContentType;
  durationSeconds: number | null;
}

export interface PublicChapterOutline {
  title: string;
  lessons: PublicLessonOutline[];
}

export interface PublicModuleOutline {
  title: string;
  description: string | null;
  chapters: PublicChapterOutline[];
}

/**
 * Public course page. Contains the outline of PUBLISHED lessons only — never lesson bodies or
 * resource URLs (those are for enrolled students, PHASE 07/10).
 */
export interface PublicCourseDetail extends PublicCourseSummary {
  description: string | null;
  /** UNLISTED pages are reachable by link but must not be indexed. */
  visibility: 'PUBLIC' | 'UNLISTED';
  lessonCount: number;
  curriculum: PublicModuleOutline[];
}
