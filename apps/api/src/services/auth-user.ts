import type { AuthUser } from '@asra/types';
import type { UserWithAccess } from '../repositories/user.repository.js';

/**
 * The ONLY way a user leaves the API. Whitelists fields, so password hashes, status internals
 * and token data can never be serialised by accident.
 */
export function toAuthUser(user: UserWithAccess): AuthUser {
  const roles = user.roles.map(({ role }) => role.key).sort();
  const permissions = [
    ...new Set(
      user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
    ),
  ].sort();

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    emailVerified: user.emailVerifiedAt !== null,
    roles,
    permissions,
  };
}
