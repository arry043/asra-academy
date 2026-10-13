import { createAccessControlRepository } from '../../repositories/access-control.repository.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PERMISSION_DEFINITIONS, SYSTEM_ROLES } from './access-control.data.js';

export interface AccessControlSeedResult {
  roles: number;
  permissions: number;
  grantsAdded: number;
}

/**
 * Idempotently synchronises the system roles and permissions.
 *
 * - Roles and permissions are upserted by their stable `key`, so re-running never duplicates.
 * - Grants are added with `skipDuplicates`; grants not in the definitions are NOT removed, so
 *   permissions an administrator adds later survive a re-seed.
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

    let grantsAdded = 0;
    for (const { permissions, ...role } of SYSTEM_ROLES) {
      const saved = await repository.upsertRole({ ...role, isSystem: true });
      const ids = permissions.map((key) => {
        const id = permissionIds.get(key);
        if (!id) throw new Error(`Role ${role.key} references unknown permission "${key}"`);
        return id;
      });
      grantsAdded += await repository.grantPermissions(saved.id, ids);
    }

    return { roles: SYSTEM_ROLES.length, permissions: permissionIds.size, grantsAdded };
  });
}
