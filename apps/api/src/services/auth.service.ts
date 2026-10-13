import type { AuthSessionData, AuthUser } from '@asra/types';
import type { LoginInput, RegisterInput } from '@asra/validation';
import { prisma } from '../database/prisma.js';
import { emailService } from '../email/email.service.js';
import { logger } from '../lib/logger.js';
import { createAccessControlRepository } from '../repositories/access-control.repository.js';
import { createUserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { toAuthUser } from './auth-user.js';
import { emailVerificationService } from './email-verification.service.js';
import { passwordService } from './password.service.js';
import { sessionService } from './session.service.js';
import { ACCESS_TOKEN_TTL_SECONDS, tokenService } from './token.service.js';

/** Public self-registration always creates a STUDENT. Other roles are provisioned by admins. */
const SELF_REGISTRATION_ROLE = 'STUDENT';

const invalidCredentials = () => new AppError('UNAUTHORIZED', 'Invalid email or password');

/** An authenticated session ready to hand to the client. */
export interface IssuedSession {
  session: AuthSessionData;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function loadAuthUser(userId: string): Promise<AuthUser> {
  const user = await createUserRepository(prisma).findByIdWithAccess(userId);
  if (!user) throw invalidCredentials();
  return toAuthUser(user);
}

async function issueAccess(refresh: {
  sessionId: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<IssuedSession> {
  const [accessToken, user] = await Promise.all([
    tokenService.signAccessToken({ sub: refresh.userId, sid: refresh.sessionId }),
    loadAuthUser(refresh.userId),
  ]);
  return {
    session: { accessToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS, user },
    refreshToken: refresh.refreshToken,
    refreshExpiresAt: refresh.expiresAt,
  };
}

export const authService = {
  /**
   * Registers a STUDENT. The response is identical whether or not the email is already
   * registered (no account enumeration): an existing owner receives an "account exists" notice
   * instead of a verification link. The password is hashed in both paths to keep timing equal.
   */
  async register(input: RegisterInput): Promise<void> {
    const passwordHash = await passwordService.hash(input.password);
    const users = createUserRepository(prisma);

    const existing = await users.findByEmail(input.email);
    if (existing) {
      await emailService
        .sendAccountExistsNotice(existing.email, existing.fullName)
        .catch((error) =>
          logger.error({ err: error, userId: existing.id }, 'Could not send account-exists notice'),
        );
      return;
    }

    const role = await createAccessControlRepository(prisma).findRoleByKey(SELF_REGISTRATION_ROLE);
    if (!role) {
      // Roles are reference data from the seed; never created implicitly.
      throw new Error(`Role ${SELF_REGISTRATION_ROLE} is missing — run "npm run db:seed"`);
    }

    let user;
    try {
      user = await users.create({
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        roleId: role.id,
        profile: 'student',
      });
    } catch (error) {
      // Lost a race with a concurrent registration of the same email: same generic outcome.
      if ((error as { code?: string }).code === 'P2002') return;
      throw error;
    }

    try {
      await emailVerificationService.issueAndSend(user);
    } catch (error) {
      // The account exists; the user can request a new link via resend-verification.
      logger.error({ err: error, userId: user.id }, 'Could not send verification email');
    }
  },

  /**
   * Generic 401 for unknown email or wrong password (with equalised timing). Account state is
   * revealed only AFTER the correct password is proven.
   */
  async login(input: LoginInput): Promise<IssuedSession> {
    const users = createUserRepository(prisma);
    const user = await users.findByEmail(input.email);

    if (!user?.passwordHash) {
      await passwordService.verifyDummy(input.password);
      throw invalidCredentials();
    }
    if (!(await passwordService.verify(user.passwordHash, input.password))) {
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_DISABLED', 'This account is disabled. Contact the academy.');
    }
    if (!user.emailVerifiedAt) {
      throw new AppError(
        'EMAIL_NOT_VERIFIED',
        'Please verify your email address before signing in. Check your inbox for the link.',
      );
    }

    if (passwordService.needsRehash(user.passwordHash)) {
      await users.updatePasswordHash(user.id, await passwordService.hash(input.password));
    }

    return issueAccess(await sessionService.create(user.id));
  },

  async refresh(refreshToken: string): Promise<IssuedSession> {
    return issueAccess(await sessionService.rotate(refreshToken));
  },

  logout(refreshToken: string | undefined): Promise<void> {
    return refreshToken ? sessionService.revokeByRefreshToken(refreshToken) : Promise.resolve();
  },

  logoutAll(userId: string): Promise<number> {
    return sessionService.revokeAllForUser(userId);
  },
};
