import type { DbClient } from '../database/types.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Loads a user's current roles and their permission grants. Used wherever an authorization
 * decision is made, so decisions always reflect the database — never token claims.
 */
export const userWithAccessInclude = {
  roles: {
    select: {
      role: {
        select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccessInclude }>;

export interface NewUserInput {
  email: string;
  fullName: string;
  passwordHash: string;
  roleId: string;
  emailVerifiedAt?: Date;
  profile: 'student' | 'faculty' | 'none';
}

export function createUserRepository(db: DbClient) {
  return {
    findByEmail(email: string) {
      return db.user.findUnique({ where: { email } });
    },

    findById(id: string) {
      return db.user.findUnique({ where: { id } });
    },

    findByIdWithAccess(id: string) {
      return db.user.findUnique({ where: { id }, include: userWithAccessInclude });
    },

    /** Creates the user, its single role assignment and (optionally) an empty profile. */
    create(input: NewUserInput) {
      return db.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash: input.passwordHash,
          emailVerifiedAt: input.emailVerifiedAt ?? null,
          roles: { create: { roleId: input.roleId } },
          ...(input.profile === 'student' ? { studentProfile: { create: {} } } : {}),
          ...(input.profile === 'faculty' ? { facultyProfile: { create: {} } } : {}),
        },
      });
    },

    updatePasswordHash(id: string, passwordHash: string) {
      return db.user.update({ where: { id }, data: { passwordHash } });
    },

    /** Sets `emailVerifiedAt` only if not already set. Returns the number of rows changed. */
    async markEmailVerified(id: string, at: Date): Promise<number> {
      const { count } = await db.user.updateMany({
        where: { id, emailVerifiedAt: null },
        data: { emailVerifiedAt: at },
      });
      return count;
    },
  };
}
