import { PERMISSIONS, type PermissionKey, type UserRole } from '@asra/types';
import { prisma } from '../database/prisma.js';
import type { DbClient } from '../database/types.js';
import { createCourseInstructorRepository } from '../repositories/course-instructor.repository.js';
import type { AuthContext } from '../types/auth.js';
import { AppError } from '../utils/app-error.js';

/**
 * Service-level authorization policies (docs/AUTHENTICATION.md §Resource ownership).
 *
 * Route middleware (`requireRole`/`requirePermission`) answers "may this user perform this
 * KIND of action?". It cannot answer "on THIS course?". Every business endpoint must ALSO call
 * a resource policy like the ones below from its service, with the resource id.
 */
export const accessPolicy = {
  hasRole(auth: AuthContext, role: UserRole): boolean {
    return auth.roles.has(role);
  },

  hasPermission(auth: AuthContext, permission: PermissionKey): boolean {
    return auth.permissions.has(permission);
  },

  /** Throws 403 unless the user holds the permission. For use inside services. */
  assertPermission(auth: AuthContext, permission: PermissionKey): void {
    if (!auth.permissions.has(permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action');
    }
  },

  /**
   * Course content management:
   *   - `content.manage` (admins)            → any course
   *   - `content.manage_assigned` (faculty)  → only courses they are assigned to (CourseInstructor)
   */
  async canManageCourseContent(
    auth: AuthContext,
    courseId: string,
    db: DbClient = prisma,
  ): Promise<boolean> {
    if (auth.permissions.has(PERMISSIONS.CONTENT_MANAGE)) return true;
    if (!auth.permissions.has(PERMISSIONS.CONTENT_MANAGE_ASSIGNED)) return false;
    return createCourseInstructorRepository(db).isUserAssignedToCourse(auth.userId, courseId);
  },

  async assertCanManageCourseContent(
    auth: AuthContext,
    courseId: string,
    db: DbClient = prisma,
  ): Promise<void> {
    if (!(await accessPolicy.canManageCourseContent(auth, courseId, db))) {
      // 403 rather than 404 is acceptable here: course ids are not secret.
      throw new AppError('FORBIDDEN', 'You are not assigned to this course');
    }
  },

  /**
   * Faculty teaching access (PHASE 08, docs/FACULTY-PORTAL.md §2): the permission AND a
   * `CourseInstructor` assignment of THIS user to the course. Unlike content management there is
   * no "any course" bypass — student work, grades and live classes are reached only through an
   * assignment made by an administrator. `courseId` must come from the database.
   */
  async assertTeachesCourse(
    auth: AuthContext,
    courseId: string,
    permission: PermissionKey,
    db: DbClient = prisma,
  ): Promise<void> {
    if (!auth.permissions.has(permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action');
    }
    if (
      !(await createCourseInstructorRepository(db).isUserAssignedToCourse(auth.userId, courseId))
    ) {
      throw new AppError('FORBIDDEN', 'You are not assigned to this course');
    }
  },

  /** Courses the faculty member teaches, for list endpoints (empty without the permission). */
  async taughtCourseIds(
    auth: AuthContext,
    permission: PermissionKey,
    db: DbClient = prisma,
  ): Promise<string[]> {
    if (!auth.permissions.has(permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action');
    }
    return createCourseInstructorRepository(db).assignedCourseIds(auth.userId);
  },

  /**
   * Student entitlement to a course's protected content (docs/STUDENT-LMS.md §2):
   * `content.view_enrolled` + the course is PUBLISHED + an ACTIVE enrolment for THIS user.
   * Visibility only governs the public website; a PRIVATE course is open to its enrolled students.
   * Publication alone never grants access, and nothing from the request body is consulted.
   *
   * Throws 404 when the course is not published (or PRIVATE without enrolment) so its existence
   * is not disclosed, and 403 when a visible course exists but the student is not enrolled.
   * Returns the enrolment, which callers use for resume/last-activity updates.
   */
  async assertCanViewCourseContent(
    auth: AuthContext,
    courseId: string,
    db: DbClient = prisma,
  ): Promise<{ id: string; completedAt: Date | null; lastLessonId: string | null }> {
    if (!auth.permissions.has(PERMISSIONS.CONTENT_VIEW_ENROLLED)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action');
    }
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { status: true, visibility: true },
    });
    if (!course || course.status !== 'PUBLISHED') {
      throw new AppError('NOT_FOUND', 'Course not found');
    }
    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId } },
      select: { id: true, status: true, completedAt: true, lastLessonId: true },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      if (course.visibility === 'PRIVATE') throw new AppError('NOT_FOUND', 'Course not found');
      throw new AppError('FORBIDDEN', 'You are not enrolled in this course');
    }
    return enrollment;
  },
};
