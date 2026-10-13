import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../lib/logger.js';
import { createSessionRepository } from '../repositories/session.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { generateOpaqueToken, hashToken } from '../utils/crypto.js';

const SESSION_TTL_MS = env.REFRESH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

const invalidRefresh = () =>
  new AppError('UNAUTHORIZED', 'Your session has expired. Sign in again.');

export interface IssuedRefresh {
  sessionId: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Refresh sessions (docs/AUTHENTICATION.md §Refresh-token rotation).
 *
 * Refresh tokens are 256-bit opaque random strings; only their SHA-256 hash is stored. Every
 * refresh rotates the token. The previous token's hash is kept: presenting it again means it
 * was copied, so the whole session is revoked (theft detection, RFC 9700 §4.14.2).
 */
export const sessionService = {
  async create(userId: string): Promise<IssuedRefresh> {
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await createSessionRepository(prisma).create({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });
    return { sessionId: session.id, userId, refreshToken, expiresAt };
  },

  async rotate(presentedToken: string): Promise<IssuedRefresh> {
    const sessions = createSessionRepository(prisma);
    const presentedHash = hashToken(presentedToken);
    const now = new Date();

    const session = await sessions.findByTokenHash(presentedHash);
    if (!session) throw invalidRefresh();

    const revokeForReuse = async () => {
      const revoked = await sessions.revoke(session.id, 'TOKEN_REUSE', now);
      if (revoked) {
        logger.warn(
          { sessionId: session.id, userId: session.userId },
          'Refresh-token reuse detected — session revoked',
        );
      }
      return invalidRefresh();
    };

    if (session.previousTokenHash === presentedHash) throw await revokeForReuse();
    if (session.revokedAt || session.expiresAt <= now) throw invalidRefresh();

    const user = await createUserRepository(prisma).findById(session.userId);
    if (!user) throw invalidRefresh();
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_DISABLED', 'This account is disabled. Contact the academy.');
    }

    const refreshToken = generateOpaqueToken();
    const rotated = await sessions.rotate(session.id, presentedHash, hashToken(refreshToken), now);
    // Lost a race with a concurrent refresh of the same token: that is indistinguishable from
    // replay, so the session is revoked and neither request keeps a usable token.
    if (rotated === 0) throw await revokeForReuse();

    return {
      sessionId: session.id,
      userId: session.userId,
      refreshToken,
      expiresAt: session.expiresAt,
    };
  },

  /** Revokes the session that owns this refresh token (current or previous). Idempotent. */
  async revokeByRefreshToken(presentedToken: string): Promise<void> {
    const sessions = createSessionRepository(prisma);
    const session = await sessions.findByTokenHash(hashToken(presentedToken));
    if (session) await sessions.revoke(session.id, 'LOGOUT', new Date());
  },

  async revokeAllForUser(userId: string): Promise<number> {
    return createSessionRepository(prisma).revokeAllForUser(userId, 'LOGOUT_ALL', new Date());
  },
};
