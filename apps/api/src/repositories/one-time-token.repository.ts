import type { DbClient } from '../database/types.js';
import type { OneTimeTokenPurpose } from '../generated/prisma/client.js';

export function createOneTimeTokenRepository(db: DbClient) {
  return {
    /** Deletes the user's unused tokens of this purpose, then stores the new token's hash. */
    async replaceForUser(input: {
      userId: string;
      purpose: OneTimeTokenPurpose;
      tokenHash: string;
      expiresAt: Date;
    }) {
      await db.oneTimeToken.deleteMany({
        where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
      });
      return db.oneTimeToken.create({ data: input });
    },

    /** An unexpired, unconsumed token with this hash and purpose, with its user. */
    findUsable(tokenHash: string, purpose: OneTimeTokenPurpose, now: Date) {
      return db.oneTimeToken.findFirst({
        where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: now } },
        include: { user: true },
      });
    },

    /**
     * Atomically marks the token consumed. Only one concurrent caller gets 1; the others get 0
     * and must abort — this is what makes the token single-use.
     */
    async consume(id: string, now: Date): Promise<number> {
      const { count } = await db.oneTimeToken.updateMany({
        where: { id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      return count;
    },

    async deleteUnusedForUser(userId: string, purpose: OneTimeTokenPurpose): Promise<void> {
      await db.oneTimeToken.deleteMany({ where: { userId, purpose, consumedAt: null } });
    },
  };
}
