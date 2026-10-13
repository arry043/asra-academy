import type { DbClient } from '../database/types.js';
import type { SessionRevocationReason } from '../generated/prisma/client.js';
import { userWithAccessInclude } from './user.repository.js';

export function createSessionRepository(db: DbClient) {
  return {
    create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
      return db.authSession.create({ data: input });
    },

    /** Finds the session whose current OR immediately previous refresh token has this hash. */
    findByTokenHash(tokenHash: string) {
      return db.authSession.findFirst({
        where: { OR: [{ tokenHash }, { previousTokenHash: tokenHash }] },
      });
    },

    /** Session plus its user's current roles/permissions — one query per authenticated request. */
    findByIdWithUser(id: string) {
      return db.authSession.findUnique({
        where: { id },
        include: { user: { include: userWithAccessInclude } },
      });
    },

    /**
     * Compare-and-swap rotation: succeeds only if `currentHash` is still the session's token and
     * the session is active. PostgreSQL row locking makes concurrent rotations of the same token
     * serialise; exactly one sees count = 1. Returns the number of rows updated (0 or 1).
     */
    async rotate(id: string, currentHash: string, nextHash: string, now: Date): Promise<number> {
      const { count } = await db.authSession.updateMany({
        where: { id, tokenHash: currentHash, revokedAt: null, expiresAt: { gt: now } },
        data: { tokenHash: nextHash, previousTokenHash: currentHash, lastUsedAt: now },
      });
      return count;
    },

    /** Revokes one session if still active. Idempotent. */
    async revoke(id: string, reason: SessionRevocationReason, now: Date): Promise<number> {
      const { count } = await db.authSession.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
      });
      return count;
    },

    async revokeAllForUser(
      userId: string,
      reason: SessionRevocationReason,
      now: Date,
    ): Promise<number> {
      const { count } = await db.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
      });
      return count;
    },
  };
}
