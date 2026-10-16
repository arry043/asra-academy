import { PERMISSIONS, type PermissionKey, type UserRole } from '@asra/types';

/**
 * Reference data for the initial RBAC model. Every permission traces to a documented
 * requirement (docs/SRS.md §4, §8–11); see docs/DATABASE.md §Seed for the matrix.
 * Admin sub-roles and Parent/Guardian are pending (CLIENT-CLARIFICATIONS S-01, E-03).
 */
export const PERMISSION_DEFINITIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.SYSTEM_MANAGE]: 'Manage platform settings and system configuration',
  [PERMISSIONS.ADMINS_MANAGE]: 'Create, update and disable administrator accounts',
  [PERMISSIONS.ROLES_MANAGE]: 'Manage roles and the permissions granted to them',
  [PERMISSIONS.STUDENTS_MANAGE]: 'Manage student accounts',
  [PERMISSIONS.FACULTY_MANAGE]: 'Manage faculty accounts and profiles',
  [PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE]: 'Manage academic levels, classes, streams and subjects',
  [PERMISSIONS.COURSES_MANAGE]: 'Manage courses, course categories and instructor assignments',
  [PERMISSIONS.CONTENT_MANAGE]: 'Manage learning content of any course',
  [PERMISSIONS.CONTENT_MANAGE_ASSIGNED]: 'Manage learning content of assigned courses',
  [PERMISSIONS.ENROLLMENTS_MANAGE]: 'Enrol students in courses and cancel enrolments',
  [PERMISSIONS.CONTENT_VIEW_ENROLLED]: 'View learning content of enrolled courses',
  [PERMISSIONS.PROFILE_MANAGE_OWN]: 'View and update own profile',
};

interface SystemRoleDefinition {
  key: UserRole;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

const ALL_PERMISSIONS = Object.keys(PERMISSION_DEFINITIONS) as PermissionKey[];

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Platform owner: manages administrators, roles and system settings',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Academy administrator: manages students, faculty, academics and courses',
    permissions: [
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.FACULTY_MANAGE,
      PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE,
      PERMISSIONS.COURSES_MANAGE,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.ENROLLMENTS_MANAGE,
      PERMISSIONS.PROFILE_MANAGE_OWN,
    ],
  },
  {
    key: 'FACULTY',
    name: 'Faculty',
    description: 'Teacher allocated to subjects and courses',
    permissions: [PERMISSIONS.CONTENT_MANAGE_ASSIGNED, PERMISSIONS.PROFILE_MANAGE_OWN],
  },
  {
    key: 'STUDENT',
    name: 'Student',
    description: 'Registered learner',
    permissions: [PERMISSIONS.CONTENT_VIEW_ENROLLED, PERMISSIONS.PROFILE_MANAGE_OWN],
  },
];
