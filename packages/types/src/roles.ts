/**
 * Initial platform roles (see docs/SRS.md §4). Parent/Guardian and admin sub-roles are
 * pending client confirmation and will be added once confirmed. Roles are stored as data
 * (`roles` table), so new roles do not require a schema change.
 */
export const USER_ROLES = ['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Initial permission catalogue, derived from the documented role capabilities
 * (docs/SRS.md §8–11, docs/DATABASE.md §Seed). Keys are `<resource>.<action>`.
 * Enforcement (RBAC middleware) arrives in PHASE 03.
 */
export const PERMISSIONS = {
  /** Platform settings and system configuration — SRS §4 (Super Admin). */
  SYSTEM_MANAGE: 'system.manage',
  /** Create/disable admin accounts — FR-ADM-014. */
  ADMINS_MANAGE: 'admins.manage',
  /** Manage roles and their permissions — FR-RBAC-005. */
  ROLES_MANAGE: 'roles.manage',
  /** Manage student accounts — FR-ADM-001. */
  STUDENTS_MANAGE: 'students.manage',
  /** Manage faculty accounts and profiles — FR-ADM-002. */
  FACULTY_MANAGE: 'faculty.manage',
  /** Manage academic levels, classes, streams and subjects — FR-ADM-003, FR-ACA-003. */
  ACADEMIC_STRUCTURE_MANAGE: 'academic_structure.manage',
  /** Manage courses, categories and instructor assignments — FR-ADM-004. */
  COURSES_MANAGE: 'courses.manage',
  /** Manage learning content of any course — FR-ADM-009. */
  CONTENT_MANAGE: 'content.manage',
  /** Manage learning content of courses the faculty member is assigned to — FR-FAC-003/004, FR-RBAC-003. */
  CONTENT_MANAGE_ASSIGNED: 'content.manage_assigned',
  /** View learning content of courses the student is enrolled in — FR-RBAC-004. */
  CONTENT_VIEW_ENROLLED: 'content.view_enrolled',
  /** View and update one's own profile — FR-STU-008. */
  PROFILE_MANAGE_OWN: 'profile.manage_own',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
