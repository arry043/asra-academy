import type {
  AdminCourseDetail,
  AdminCourseListItem,
  CatalogueRef,
  CourseCategoryDto,
  CourseInstructorDto,
  CurriculumCounts,
  FacultyOptionDto,
  PublicCourseDetail,
  PublicCourseSummary,
  PublicModuleOutline,
} from '@asra/types';
import { evaluatePublication, type PublicationSnapshot } from './publication.js';
import type {
  CategoryRow,
  CourseRow,
  CourseWithCurriculumRow,
  FacultyRow,
  PublicCourseDetailRow,
  PublicCourseRow,
} from './courses.repository.js';

const ref = (row: CatalogueRef | null): CatalogueRef | null =>
  row ? { id: row.id, name: row.name, slug: row.slug, isActive: row.isActive } : null;

/** Active account that still holds the FACULTY role — eligible for (new) assignments. */
export function isAssignableFaculty(faculty: FacultyRow): boolean {
  return (
    faculty.user.status === 'ACTIVE' && faculty.user.roles.some((r) => r.role.key === 'FACULTY')
  );
}

export function toFacultyOption(faculty: FacultyRow): FacultyOptionDto {
  return {
    facultyProfileId: faculty.id,
    fullName: faculty.user.fullName,
    designation: faculty.designation,
    employeeCode: faculty.employeeCode,
    assignable: isAssignableFaculty(faculty),
  };
}

function toInstructors(row: CourseRow): CourseInstructorDto[] {
  return row.instructors.map((item) => ({
    facultyProfileId: item.facultyProfile.id,
    fullName: item.facultyProfile.user.fullName,
    designation: item.facultyProfile.designation,
    isPrimary: item.isPrimary,
    assignable: isAssignableFaculty(item.facultyProfile),
  }));
}

export function toCategoryDto(row: CategoryRow): CourseCategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    courseCount: row._count.courses,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCourseListItem(row: CourseRow): AdminCourseListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    visibility: row.visibility,
    thumbnailUrl: row.thumbnailUrl,
    category: ref(row.category),
    class: ref(row.class),
    stream: ref(row.stream),
    subject: ref(row.subject),
    instructors: toInstructors(row),
    durationMinutes: row.durationMinutes,
    priceMinor: row.priceMinor,
    currency: row.currency,
    discountType: row.discountType,
    discountValue: row.discountValue,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicationSnapshot(row: CourseWithCurriculumRow): PublicationSnapshot {
  return {
    description: row.description,
    category: row.category,
    class: row.class,
    stream: row.stream,
    subject: row.subject,
    instructors: row.instructors.map((item) => ({
      assignable: isAssignableFaculty(item.facultyProfile),
    })),
    lessons: row.modules.flatMap((module) => module.chapters.flatMap((chapter) => chapter.lessons)),
  };
}

function countCurriculum(row: CourseWithCurriculumRow): CurriculumCounts {
  const chapters = row.modules.flatMap((module) => module.chapters);
  const lessons = chapters.flatMap((chapter) => chapter.lessons);
  return {
    modules: row.modules.length,
    chapters: chapters.length,
    lessons: lessons.length,
    publishedLessons: lessons.filter((lesson) => lesson.status === 'PUBLISHED').length,
    resources: lessons.reduce((sum, lesson) => sum + lesson.resources.length, 0),
  };
}

export function toCourseDetail(row: CourseWithCurriculumRow): AdminCourseDetail {
  return {
    ...toCourseListItem(row),
    summary: row.summary,
    description: row.description,
    counts: countCurriculum(row),
    publication: evaluatePublication(toPublicationSnapshot(row)),
  };
}

const publicRef = (row: { name: string; slug: string } | null) =>
  row ? { name: row.name, slug: row.slug } : null;

export function toPublicCourseSummary(row: PublicCourseRow): PublicCourseSummary {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    thumbnailUrl: row.thumbnailUrl,
    category: publicRef(row.category),
    class: publicRef(row.class),
    stream: publicRef(row.stream),
    subject: publicRef(row.subject),
    durationMinutes: row.durationMinutes,
    instructors: row.instructors.map((item) => ({
      fullName: item.facultyProfile.user.fullName,
      designation: item.facultyProfile.designation,
    })),
    // Public queries only return PUBLISHED rows, which always have `publishedAt` (CHECK).
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
  };
}

export function toPublicCourseDetail(row: PublicCourseDetailRow): PublicCourseDetail {
  // Only modules/chapters that contain published lessons are shown.
  const curriculum: PublicModuleOutline[] = row.modules
    .map((module) => ({
      title: module.title,
      description: module.description,
      chapters: module.chapters.filter((chapter) => chapter.lessons.length > 0),
    }))
    .filter((module) => module.chapters.length > 0);

  return {
    ...toPublicCourseSummary(row),
    description: row.description,
    visibility: row.visibility === 'UNLISTED' ? 'UNLISTED' : 'PUBLIC',
    lessonCount: curriculum.reduce(
      (sum, module) =>
        sum + module.chapters.reduce((count, chapter) => count + chapter.lessons.length, 0),
      0,
    ),
    curriculum,
  };
}
