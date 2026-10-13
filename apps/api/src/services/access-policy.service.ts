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

  // Student entitlement (`content.view_enrolled` + an active enrolment for the course) is added
  // with the Enrolment model in PHASE 10 — there is no enrolment data to check yet.
};
