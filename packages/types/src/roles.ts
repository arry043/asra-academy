/**
 * Initial platform roles (see docs/SRS.md §4). Parent/Guardian and admin sub-roles are
 * pending client confirmation and will be added once confirmed.
 */
export const USER_ROLES = ['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];
