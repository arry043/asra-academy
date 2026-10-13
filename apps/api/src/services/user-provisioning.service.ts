import { USER_ROLES, type UserRole } from '@asra/types';
import { emailSchema, fullNameSchema, passwordSchema } from '@asra/validation';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { createAccessControlRepository } from '../repositories/access-control.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { passwordService } from './password.service.js';

export const provisionUserSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
  role: z.enum(USER_ROLES),
});

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;

const PROFILE_BY_ROLE: Record<UserRole, 'student' | 'faculty' | 'none'> = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  ADMIN: 'none',
  SUPER_ADMIN: 'none',
};

/**
 * TRUSTED provisioning of any role — used by the operator CLI (`npm run auth:create-user`) and
 * tests; NOT reachable from any HTTP route. The email is marked verified because the operator
 * vouches for the address (CLIENT-CLARIFICATIONS S-05 tracks the final admin workflow).
 */
export async function provisionUser(input: ProvisionUserInput) {
  const data = provisionUserSchema.parse(input);

  const role = await createAccessControlRepository(prisma).findRoleByKey(data.role);
  if (!role) throw new Error(`Role ${data.role} is missing — run "npm run db:seed"`);

  const users = createUserRepository(prisma);
  if (await users.findByEmail(data.email)) {
    throw new AppError('CONFLICT', `A user with email ${data.email} already exists`);
  }

  return users.create({
    email: data.email,
    fullName: data.fullName,
    passwordHash: await passwordService.hash(data.password),
    roleId: role.id,
    emailVerifiedAt: new Date(),
    profile: PROFILE_BY_ROLE[data.role],
  });
}
