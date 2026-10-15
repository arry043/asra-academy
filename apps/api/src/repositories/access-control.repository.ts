import type { DbClient } from '../database/types.js';

export interface RoleInput {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
}

export interface PermissionInput {
  key: string;
  description: string;
}

export interface RolePermissionGrant {
  roleId: string;
  permissionId: string;
}

/**
 * Data access for roles, permissions and their grants. Only repositories talk to Prisma.
 *
 * Built per client so a service can pass a transaction client and keep several calls atomic:
 *   await prisma.$transaction((tx) => doWork(createAccessControlRepository(tx)));
 */
export function createAccessControlRepository(db: DbClient) {
  return {
    /** Creates the role or refreshes its descriptive fields. `key` is the stable identity. */
    upsertRole(input: RoleInput) {
      const { key, ...fields } = input;
      return db.role.upsert({ where: { key }, create: input, update: fields });
    },

    upsertPermission(input: PermissionInput) {
      const { key, ...fields } = input;
      return db.permission.upsert({ where: { key }, create: input, update: fields });
    },

    /**
     * Inserts role → permission grants in one statement; existing grants are left untouched.
     * Returns grants added.
     */
    async grantPermissions(grants: readonly RolePermissionGrant[]): Promise<number> {
      if (grants.length === 0) return 0;
      const { count } = await db.rolePermission.createMany({
        data: grants.map(({ roleId, permissionId }) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
      return count;
    },

    findRoleByKey(key: string) {
      return db.role.findUnique({ where: { key } });
    },

    findRoleByKeyWithPermissions(key: string) {
      return db.role.findUnique({
        where: { key },
        include: { permissions: { include: { permission: true } } },
      });
    },
  };
}

export type AccessControlRepository = ReturnType<typeof createAccessControlRepository>;
