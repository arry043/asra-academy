import {
  createAccessControlRepository,
  type RolePermissionGrant,
} from '../../repositories/access-control.repository.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PERMISSION_DEFINITIONS, SYSTEM_ROLES } from './access-control.data.js';

export interface AccessControlSeedResult {
  roles: number;
  permissions: number;
  grantsAdded: number;
}

/**
 * Interactive-transaction limits for the seed. Its statements run sequentially on one
 * connection, so the duration is roughly (statement count × network round trip). Prisma's
 * defaults (maxWait 2 s, timeout 5 s) suit request handlers on a nearby database, but a seed
 * run from a workstation against remote Neon can exceed them at a few hundred ms per round
 * trip (P2028). The transaction only touches the small RBAC tables, so a longer limit is safe.
 */
export const SEED_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 60_000 } as const;

/**
 * Idempotently synchronises the system roles and permissions.
 *
 * - Roles and permissions are upserted by their stable `key`, so re-running never duplicates.
 * - Grants are added in one `createMany` with `skipDuplicates`; grants not in the definitions
 *   are NOT removed, so permissions an administrator adds later survive a re-seed.
 * - Everything runs in one transaction: a failure leaves the database unchanged.
 */
export async function seedAccessControl(prisma: PrismaClient): Promise<AccessControlSeedResult> {
  return prisma.$transaction(async (tx) => {
    const repository = createAccessControlRepository(tx);

    const permissionIds = new Map<string, string>();
    for (const [key, description] of Object.entries(PERMISSION_DEFINITIONS)) {
      const permission = await repository.upsertPermission({ key, description });
      permissionIds.set(key, permission.id);
    }

    const grants: RolePermissionGrant[] = [];
    for (const { permissions, ...role } of SYSTEM_ROLES) {
      const saved = await repository.upsertRole({ ...role, isSystem: true });
      for (const key of permissions) {
        const permissionId = permissionIds.get(key);
        if (!permissionId) {
          throw new Error(`Role ${role.key} references unknown permission "${key}"`);
        }
        grants.push({ roleId: saved.id, permissionId });
      }
    }
    const grantsAdded = await repository.grantPermissions(grants);

    return { roles: SYSTEM_ROLES.length, permissions: permissionIds.size, grantsAdded };
  }, SEED_TRANSACTION_OPTIONS);
}
