import type {
  EmailOnlyInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@asra/validation';
import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../config/constants.js';
import { env } from '../config/env.js';
import { authService, type IssuedSession } from '../services/auth.service.js';
import { emailVerificationService } from '../services/email-verification.service.js';
import { passwordResetService } from '../services/password-reset.service.js';
import { sendSuccess } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';

const refreshCookieBase: CookieOptions = {
  httpOnly: true,
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  path: REFRESH_COOKIE_PATH,
  ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
};

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : undefined;
}

/** Sets the rotated refresh cookie and returns the access token in the body. */
function sendSession(res: Response, issued: IssuedSession, message: string): void {
  res.cookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
    ...refreshCookieBase,
    expires: issued.refreshExpiresAt,
  });
  sendSuccess(res, issued.session, message);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBase);
}

/** HTTP in/out only — rules live in the services. Bodies were validated by `validateRequest`. */
export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    await authService.register(req.body as RegisterInput);
    sendSuccess(
      res,
      null,
      'Registration received. If the address can be used, a verification link has been sent to it.',
      202,
    );
  },

  async login(req: Request, res: Response): Promise<void> {
    sendSession(res, await authService.login(req.body as LoginInput), 'Signed in');
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = readRefreshCookie(req);
    if (!token) throw new AppError('UNAUTHORIZED', 'Your session has expired. Sign in again.');
    try {
      sendSession(res, await authService.refresh(token), 'Session refreshed');
    } catch (error) {
      // The presented cookie is no longer valid in any failure case — drop it.
      clearRefreshCookie(res);
      throw error;
    }
  },

  /** Idempotent: always clears the cookie and succeeds, whatever state the session was in. */
  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Signed out');
  },

  async logoutAll(req: Request, res: Response): Promise<void> {
    const revoked = await authService.logoutAll(req.auth!.userId);
    clearRefreshCookie(res);
    sendSuccess(res, { revokedSessions: revoked }, 'Signed out on all devices');
  },

  me(req: Request, res: Response): void {
    sendSuccess(res, req.auth!.user);
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await passwordResetService.request((req.body as EmailOnlyInput).email);
    sendSuccess(
      res,
      null,
      'If an account exists for that address, a password reset link has been sent.',
      202,
    );
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as ResetPasswordInput;
    await passwordResetService.reset(token, password);
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Your password has been reset. Sign in with your new password.');
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const result = await emailVerificationService.verify((req.body as VerifyEmailInput).token);
    sendSuccess(
      res,
      { status: result },
      result === 'verified'
        ? 'Your email address is verified'
        : 'Your email address was already verified',
    );
  },

  async resendVerification(req: Request, res: Response): Promise<void> {
    await emailVerificationService.resend((req.body as EmailOnlyInput).email);
    sendSuccess(
      res,
      null,
      'If the address belongs to an unverified account, a new verification link has been sent.',
      202,
    );
  },
};
