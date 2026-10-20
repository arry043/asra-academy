import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { emailService } from '../email/email.service.js';
import { logger } from '../lib/logger.js';
import { dispatchAfterCommit } from '../modules/notifications/dispatcher.js';
import { notificationProducers } from '../modules/notifications/producers.js';
import { createOneTimeTokenRepository } from '../repositories/one-time-token.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { generateOpaqueToken, hashToken } from '../utils/crypto.js';

const TTL_MS = env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000;

const invalidLink = () =>
  new AppError('BAD_REQUEST', 'This verification link is invalid or has expired');

export type VerifyEmailResult = 'verified' | 'already-verified';

export const emailVerificationService = {
  /** Stores a fresh token (invalidating older ones) and emails the link. */
  async issueAndSend(user: { id: string; email: string; fullName: string }): Promise<void> {
    const token = generateOpaqueToken();
    await createOneTimeTokenRepository(prisma).replaceForUser({
      userId: user.id,
      purpose: 'EMAIL_VERIFICATION',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    await emailService.sendEmailVerification(user.email, user.fullName, token);
  },

  async verify(token: string): Promise<VerifyEmailResult> {
    const now = new Date();
    const record = await createOneTimeTokenRepository(prisma).findUsable(
      hashToken(token),
      'EMAIL_VERIFICATION',
      now,
    );
    if (!record) throw invalidLink();

    const { result, deliveries } = await prisma.$transaction(async (tx) => {
      // Single-use: only one concurrent request can consume it.
      if ((await createOneTimeTokenRepository(tx).consume(record.id, now)) === 0) {
        throw invalidLink();
      }
      const changed = await createUserRepository(tx).markEmailVerified(record.userId, now);
      // PHASE 11: the account became usable → welcome (in-app + email), once per user.
      const deliveries = changed ? await notificationProducers.welcome(tx, record.userId) : [];
      return {
        result: changed ? ('verified' as const) : ('already-verified' as const),
        deliveries,
      };
    });
    dispatchAfterCommit(deliveries);
    return result;
  },

  /**
   * Always resolves without revealing whether the address exists or is already verified.
   * Only active, unverified accounts get a new link.
   */
  async resend(email: string): Promise<void> {
    const user = await createUserRepository(prisma).findByEmail(email);
    if (!user || user.status !== 'ACTIVE' || user.emailVerifiedAt) return;
    try {
      await emailVerificationService.issueAndSend(user);
    } catch (error) {
      // Logged (without token) by the email service; the response stays generic.
      logger.error({ err: error, userId: user.id }, 'Could not resend verification email');
    }
  },
};
