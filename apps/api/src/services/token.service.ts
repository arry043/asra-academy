import { randomUUID } from 'node:crypto';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const ALGORITHM = 'HS256';
const secret = new TextEncoder().encode(env.JWT_SECRET);

export const ACCESS_TOKEN_TTL_SECONDS = env.JWT_ACCESS_TTL_MINUTES * 60;

/**
 * Claims carried by an access token. Deliberately minimal: no email, name, roles or
 * permissions — those are loaded from the database on every request (see authenticate.ts),
 * so a stale token can never grant a role that was revoked.
 */
export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  /** Refresh-session id: lets the API reject access tokens of a revoked session immediately. */
  sid: string;
}

export const tokenService = {
  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(secret);
  },

  /**
   * Verifies signature, algorithm, issuer, audience and expiry. Any failure becomes a generic
   * 401 — the reason (expired, bad signature, malformed) is never revealed to the client.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: [ALGORITHM],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        requiredClaims: ['sub', 'sid', 'exp', 'iat'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new joseErrors.JWTClaimValidationFailed('invalid claim types', payload);
      }
      return { sub: payload.sub, sid: payload.sid };
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        throw new AppError('UNAUTHORIZED', 'Invalid or expired access token');
      }
      throw error;
    }
  },
};
