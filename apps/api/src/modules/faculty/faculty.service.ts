import {
  PERMISSIONS,
  type CoursePerformanceDto,
  type FacultyCourseCard,
  type FacultyCourseDetail,
  type FacultyDashboardDto,
  type FacultyFeatures,
  type FacultyLessonListItem,
  type FacultyProfileDto,
  type FacultyStudentRow,
  type Paginated,
  type ProgressDistribution,
} from '@asra/types';
import type {
  FacultyCourseListQuery,
  FacultyLessonListQuery,
  FacultyProfileUpdateInput,
  FacultyStudentListQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { submissionService } from '../assignments/assignments.service.js';
import { liveClassService } from '../live-classes/live-classes.service.js';
import {
  courseCounts,
  facultyCourseSelect,
  percentOf,
  progressFor,
  publishedAssignments,
  toCourseCards,
  toFacultyCourseRef,
  workFor,
} from './faculty.queries.js';

/**
 * Faculty portal (PHASE 08, docs/FACULTY-PORTAL.md).
 *
 * Scope: every list starts from the courses the signed-in user is assigned to
 * (`CourseInstructor`, managed by administrators); every item endpoint resolves its course from
 * the database and calls `accessPolicy.assertTeachesCourse`. Students are shown with teaching data
 * only — no email, phone or payment information (C-04 assumption).
 */

const DASHBOARD_COURSES = 6;
const DASHBOARD_ITEMS = 5;
const ACTIVE_WINDOW_DAYS = 7;

const notFound = (entity: string): never => {
  throw new AppError('NOT_FOUND', `${entity} not found`);
};

/** Capabilities that depend on pending client decisions (reported, never simulated). */
const STATIC_FEATURES: Omit<FacultyFeatures, 'liveClassProvider'> = {
  fileUploads: {
    available: false,
    message:
      'File storage is not configured yet, so videos and PDFs cannot be uploaded. Add them as https:// links (for example an unlisted video or a shared PDF).',
  },
  quizzes: {
    available: true,
    message:
      'Set up an online quiz on any quiz lesson: multiple-choice, true/false and multiple-answer questions, scored automatically by the server.',
  },
  exams: {
    available: true,
    message:
      'Schedule timed examinations for your courses. Timing is enforced by the server; written answers are graded by you before results are published.',
  },
};

/** Google Meet is available only when the server holds its credentials (PHASE 11). */
export function facultyFeatures(): FacultyFeatures {
  return {
    liveClassProvider: liveClassService.settings().googleMeet,
    ...STATIC_FEATURES,
  };
}

const assignedCourseIds = (auth: AuthContext, permission = PERMISSIONS.CONTENT_MANAGE_ASSIGNED) =>
  accessPolicy.taughtCourseIds(auth, permission);

/** Resolves an optional `courseId` filter against the caller's courses (403 if not theirs). */
async function scopeCourses(
  auth: AuthContext,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  courseId: string | undefined,
): Promise<string[]> {
  const ids = await accessPolicy.taughtCourseIds(auth, permission);
  if (courseId === undefined) return ids;
  if (!ids.includes(courseId)) {
    if (!(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
      notFound('Course');
    }
    throw new AppError('FORBIDDEN', 'You are not assigned to this course');
  }
  return [courseId];
}

function emptyDistribution(): ProgressDistribution {
  return { none: 0, '0': 0, '1-24': 0, '25-49': 0, '50-74': 0, '75-99': 0, '100': 0 };
}

function bucketOf(percent: number | null): keyof ProgressDistribution {
  if (percent === null) return 'none';
  if (percent === 0) return '0';
  if (percent < 25) return '1-24';
  if (percent < 50) return '25-49';
  if (percent < 75) return '50-74';
  if (percent < 100) return '75-99';
  return '100';
}

export const facultyService = {
  features(): FacultyFeatures {
    return facultyFeatures();
  },

  async dashboard(auth: AuthContext): Promise<FacultyDashboardDto> {
    const ids = await assignedCourseIds(auth);
    const [user, rows, counts, students, upcomingClasses, pendingSubmissions] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { fullName: true, facultyProfile: { select: { designation: true } } },
      }),
      prisma.course.findMany({
        where: { id: { in: ids } },
        select: facultyCourseSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: DASHBOARD_COURSES,
      }),
      courseCounts(ids),
      ids.length === 0
        ? Promise.resolve([])
        : prisma.enrollment.findMany({
            where: { courseId: { in: ids }, status: 'ACTIVE' },
            distinct: ['userId'],
            select: { userId: true },
          }),
      auth.permissions.has(PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED)
        ? liveClassService.upcomingFor(ids, DASHBOARD_ITEMS)
        : Promise.resolve([]),
      auth.permissions.has(PERMISSIONS.SUBMISSIONS_GRADE_ASSIGNED)
        ? submissionService.pendingFor(ids, DASHBOARD_ITEMS)
        : Promise.resolve([]),
    ]);
    const sum = (
      key:
        'assignments' | 'pendingReviews' | 'gradedUnreleased' | 'upcomingClasses' | 'quizLessons',
    ) => [...counts.values()].reduce((total, row) => total + row[key], 0);

    return {
      faculty: { fullName: user.fullName, designation: user.facultyProfile?.designation ?? null },
      stats: {
        courses: ids.length,
        activeStudents: students.length,
        assignments: sum('assignments'),
        pendingReviews: sum('pendingReviews'),
        gradedUnreleased: sum('gradedUnreleased'),
        upcomingClasses: sum('upcomingClasses'),
        quizLessons: sum('quizLessons'),
      },
      courses: await toCourseCards(auth.userId, rows),
      upcomingClasses,
      pendingSubmissions,
      features: facultyFeatures(),
    };
  },

  async courses(
    auth: AuthContext,
    query: FacultyCourseListQuery,
  ): Promise<Paginated<FacultyCourseCard>> {
    const ids = await assignedCourseIds(auth);
    const where: Prisma.CourseWhereInput = {
      id: { in: ids },
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { subject: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: facultyCourseSelect,
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.course.count({ where }),
    ]);
    return paginated(await toCourseCards(auth.userId, rows), total, query);
  },

  async course(auth: AuthContext, courseId: string): Promise<FacultyCourseDetail> {
    const row =
      (await prisma.course.findUnique({
        where: { id: courseId },
        select: {
          ...facultyCourseSelect,
          summary: true,
          description: true,
          durationMinutes: true,
          instructors: {
            orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
            select: {
              isPrimary: true,
              facultyProfile: {
                select: { userId: true, designation: true, user: { select: { fullName: true } } },
              },
            },
          },
          _count: { select: { modules: true } },
        },
      })) ?? notFound('Course');
    await accessPolicy.assertTeachesCourse(auth, courseId, PERMISSIONS.CONTENT_MANAGE_ASSIGNED);
    const [card, chapters, counts] = await Promise.all([
      toCourseCards(auth.userId, [row]),
      prisma.chapter.count({ where: { module: { courseId } } }),
      courseCounts([courseId]),
    ]);
    return {
      ...card[0]!,
      summary: row.summary,
      description: row.description,
      durationMinutes: row.durationMinutes,
      instructors: row.instructors.map((item) => ({
        fullName: item.facultyProfile.user.fullName,
        designation: item.facultyProfile.designation,
        isPrimary: item.isPrimary,
        isYou: item.facultyProfile.userId === auth.userId,
      })),
      modules: row._count.modules,
      chapters,
      quizLessons: counts.get(courseId)?.quizLessons ?? 0,
    };
  },

  /** Students with an ACTIVE enrolment in the caller's courses (one row per enrolment). */
  async students(
    auth: AuthContext,
    query: FacultyStudentListQuery,
  ): Promise<Paginated<FacultyStudentRow>> {
    const ids = await scopeCourses(auth, PERMISSIONS.STUDENTS_VIEW_ASSIGNED, query.courseId);
    if (ids.length === 0) return paginated([], 0, query);
    const where: Prisma.EnrollmentWhereInput = {
      courseId: { in: ids },
      status: 'ACTIVE',
      ...(query.q ? { user: { fullName: { contains: query.q, mode: 'insensitive' } } } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        orderBy: [{ user: { fullName: 'asc' } }, { course: { title: 'asc' } }, { id: 'asc' }],
        select: {
          id: true,
          userId: true,
          courseId: true,
          enrolledAt: true,
          lastActivityAt: true,
          completedAt: true,
          course: { select: { id: true, title: true } },
          // Teaching data only: no email, phone or account details (C-04).
          user: {
            select: {
              fullName: true,
              studentProfile: {
                select: {
                  class: { select: { name: true, slug: true } },
                  stream: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
        skip,
        take,
      }),
      prisma.enrollment.count({ where }),
    ]);
    const [{ progress }, work] = await Promise.all([progressFor(rows), workFor(rows)]);
    return paginated(
      rows.map((row, index) => ({
        enrollmentId: row.id,
        student: {
          userId: row.userId,
          fullName: row.user.fullName,
          class: row.user.studentProfile?.class ?? null,
          stream: row.user.studentProfile?.stream ?? null,
        },
        course: row.course,
        enrolledAt: row.enrolledAt.toISOString(),
        lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        progress: progress[index]!,
        work: work[index]!,
      })),
      total,
      query,
    );
  },

  /** Course-level teaching metrics (definitions: docs/FACULTY-PORTAL.md §7). */
  async performance(auth: AuthContext, courseId: string): Promise<CoursePerformanceDto> {
    const course =
      (await prisma.course.findUnique({ where: { id: courseId }, select: facultyCourseSelect })) ??
      notFound('Course');
    await accessPolicy.assertTeachesCourse(auth, courseId, PERMISSIONS.STUDENTS_VIEW_ASSIGNED);

    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);
    const [enrollments, assignments, counts] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE' },
        select: { userId: true, courseId: true, completedAt: true, lastActivityAt: true },
      }),
      publishedAssignments([courseId]),
      courseCounts([courseId]),
    ]);
    const { progress, views } = await progressFor(enrollments);
    const distribution = emptyDistribution();
    for (const item of progress) distribution[bucketOf(item.percent)] += 1;
    const percents = progress.flatMap((item) => (item.percent === null ? [] : [item.percent]));

    // Submissions of currently enrolled students to published assignments only.
    const activeUserIds = enrollments.map((row) => row.userId);
    const submissions =
      assignments.size === 0 || activeUserIds.length === 0
        ? []
        : await prisma.assignmentSubmission.findMany({
            where: { assignmentId: { in: [...assignments.keys()] }, userId: { in: activeUserIds } },
            select: {
              assignmentId: true,
              status: true,
              marksAwarded: true,
              resultReleasedAt: true,
            },
          });
    let marks = 0;
    let max = 0;
    let released = 0;
    for (const row of submissions) {
      if (row.resultReleasedAt !== null && row.marksAwarded !== null) {
        released += 1;
        marks += row.marksAwarded;
        max += assignments.get(row.assignmentId)!.maxMarks;
      }
    }

    return {
      course: toFacultyCourseRef(course),
      metrics: {
        activeStudents: enrollments.length,
        countableLessons: views.get(courseId)?.eligibleIds.length ?? 0,
        averageProgressPercent:
          percents.length === 0
            ? null
            : Math.floor(percents.reduce((total, value) => total + value, 0) / percents.length),
        completedStudents: enrollments.filter((row) => row.completedAt !== null).length,
        activeLast7Days: enrollments.filter(
          (row) => row.lastActivityAt !== null && row.lastActivityAt >= since,
        ).length,
        distribution,
        publishedAssignments: assignments.size,
        submissions: submissions.length,
        pendingReviews: counts.get(courseId)?.pendingReviews ?? 0,
        gradedUnreleased: counts.get(courseId)?.gradedUnreleased ?? 0,
        released,
        submissionRatePercent: percentOf(submissions.length, assignments.size * enrollments.length),
        releasedScorePercent: percentOf(marks, max),
      },
    };
  },

  /** Lessons of one kind (e.g. QUIZ placeholders) in the caller's courses, any status. */
  async lessonsByType(
    auth: AuthContext,
    query: FacultyLessonListQuery,
  ): Promise<Paginated<FacultyLessonListItem>> {
    const ids = await scopeCourses(auth, PERMISSIONS.CONTENT_MANAGE_ASSIGNED, query.courseId);
    if (ids.length === 0) return paginated([], 0, query);
    const where: Prisma.LessonWhereInput = {
      contentType: query.contentType,
      chapter: { module: { courseId: { in: ids } } },
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        orderBy: [
          { chapter: { module: { course: { title: 'asc' } } } },
          { chapter: { module: { position: 'asc' } } },
          { chapter: { position: 'asc' } },
          { position: 'asc' },
        ],
        select: {
          id: true,
          title: true,
          contentType: true,
          status: true,
          updatedAt: true,
          chapter: {
            select: {
              title: true,
              module: { select: { title: true, course: { select: { id: true, title: true } } } },
            },
          },
        },
        skip,
        take,
      }),
      prisma.lesson.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({
        course: row.chapter.module.course,
        lesson: {
          lessonId: row.id,
          lessonTitle: row.title,
          contentType: row.contentType,
          chapterTitle: row.chapter.title,
          moduleTitle: row.chapter.module.title,
        },
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  },

  // Profile -----------------------------------------------------------------------------------

  async profile(auth: AuthContext): Promise<FacultyProfileDto> {
    const user =
      (await prisma.user.findUnique({
        where: { id: auth.userId },
        select: {
          fullName: true,
          email: true,
          phone: true,
          createdAt: true,
          facultyProfile: {
            select: {
              employeeCode: true,
              designation: true,
              bio: true,
              qualifications: true,
              specialization: true,
              experienceYears: true,
              isPublic: true,
              courses: {
                orderBy: { course: { title: 'asc' } },
                select: {
                  isPrimary: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                      subject: { select: { name: true, slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })) ?? notFound('Profile');
    const faculty = user.facultyProfile;
    if (!faculty) notFound('Faculty profile');
    const subjects = new Map<string, { name: string; slug: string }>();
    for (const item of faculty!.courses) {
      if (item.course.subject) subjects.set(item.course.subject.slug, item.course.subject);
    }
    return {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      employeeCode: faculty!.employeeCode,
      designation: faculty!.designation,
      bio: faculty!.bio,
      qualifications: faculty!.qualifications,
      specialization: faculty!.specialization,
      experienceYears: faculty!.experienceYears,
      isPublic: faculty!.isPublic,
      memberSince: user.createdAt.toISOString(),
      subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name)),
      courses: faculty!.courses.map((item) => ({
        id: item.course.id,
        title: item.course.title,
        status: item.course.status,
        isPrimary: item.isPrimary,
      })),
    };
  },

  /** Only the self-service fields of the strict schema; allocation is never changed here. */
  async updateProfile(
    auth: AuthContext,
    input: FacultyProfileUpdateInput,
  ): Promise<FacultyProfileDto> {
    const { fullName, phone, ...professional } = withoutUndefined(input);
    await prisma.$transaction(async (tx) => {
      const profile = await tx.facultyProfile.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!profile) notFound('Faculty profile');
      if (fullName !== undefined || phone !== undefined) {
        await tx.user.update({
          where: { id: auth.userId },
          data: withoutUndefined({ fullName, phone }),
          select: { id: true },
        });
      }
      if (Object.keys(professional).length > 0) {
        await tx.facultyProfile.update({
          where: { id: profile!.id },
          data: professional,
          select: { id: true },
        });
      }
    });
    return facultyService.profile(auth);
  },
};
