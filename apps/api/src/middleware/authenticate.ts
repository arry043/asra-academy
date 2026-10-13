import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { createSessionRepository } from '../repositories/session.repository.js';
import { toAuthUser } from '../services/auth-user.js';
import { tokenService } from '../services/token.service.js';
import { AppError } from '../utils/app-error.js';

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

const unauthorized = (message = 'Authentication required') => new AppError('UNAUTHORIZED', message);

/**
 * Requires `Authorization: Bearer <access token>`. On success sets a strongly typed `req.auth`.
 *
 * Besides verifying the JWT (signature, algorithm, issuer, audience, expiry) it loads the
 * session and user from PostgreSQL in ONE query and rejects the request when:
 *   - the refresh session was revoked (logout, reuse, password reset) or has expired,
 *   - the account is no longer ACTIVE.
 * Roles and permissions come from that query, never from token claims. Every failure is a
 * generic 401 so the reason is not disclosed.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header) throw unauthorized();

  const match = BEARER.exec(header);
  if (!match?.[1]) throw unauthorized('Invalid or expired access token');

  const claims = await tokenService.verifyAccessToken(match[1]);
  const session = await createSessionRepository(prisma).findByIdWithUser(claims.sid);

  if (
    !session ||
    session.userId !== claims.sub ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    throw unauthorized('Invalid or expired access token');
  }

  const user = toAuthUser(session.user);
  req.auth = {
    userId: user.id,
    sessionId: session.id,
    user,
    roles: new Set(user.roles),
    permissions: new Set(user.permissions),
  };
  next();
}
