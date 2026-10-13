import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { emailService } from '../email/email.service.js';
import { logger } from '../lib/logger.js';
import { createOneTimeTokenRepository } from '../repositories/one-time-token.repository.js';
import { createSessionRepository } from '../repositories/session.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { generateOpaqueToken, hashToken } from '../utils/crypto.js';
import { passwordService } from './password.service.js';

const TTL_MS = env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

const invalidLink = () =>
  new AppError('BAD_REQUEST', 'This password reset link is invalid or has expired');

export const passwordResetService = {
  /**
   * Always resolves with no indication of whether the account exists (no enumeration).
   * Only ACTIVE accounts receive a link; delivery failures are logged, not reported.
   */
  async request(email: string): Promise<void> {
    const user = await createUserRepository(prisma).findByEmail(email);
    if (!user || user.status !== 'ACTIVE') return;

    const token = generateOpaqueToken();
    await createOneTimeTokenRepository(prisma).replaceForUser({
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    try {
      await emailService.sendPasswordReset(user.email, user.fullName, token);
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Could not send password reset email');
    }
  },

  /**
   * Sets a new password. In one transaction: consumes the token (single-use, race-safe),
   * stores the new hash, revokes every refresh session of the user (policy: a reset signs out
   * all devices) and marks the email verified (the link proved control of the mailbox).
   */
  async reset(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const record = await createOneTimeTokenRepository(prisma).findUsable(
      hashToken(token),
      'PASSWORD_RESET',
      now,
    );
    if (!record || record.user.status !== 'ACTIVE') throw invalidLink();

    // Hash outside the transaction: Argon2 is deliberately slow; don't hold locks meanwhile.
    const passwordHash = await passwordService.hash(newPassword);

    await prisma.$transaction(async (tx) => {
      const tokens = createOneTimeTokenRepository(tx);
      if ((await tokens.consume(record.id, now)) === 0) throw invalidLink();

      const users = createUserRepository(tx);
      await users.updatePasswordHash(record.userId, passwordHash);
      await users.markEmailVerified(record.userId, now);
      await tokens.deleteUnusedForUser(record.userId, 'PASSWORD_RESET');
      await createSessionRepository(tx).revokeAllForUser(record.userId, 'PASSWORD_RESET', now);
    });
  },
};
