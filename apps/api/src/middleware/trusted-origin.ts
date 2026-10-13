import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for routes that act on the refresh-token cookie (docs/AUTHENTICATION.md §CSRF).
 * Layered with the SameSite=Strict cookie; CORS alone does NOT stop CSRF because a simple
 * cross-site form POST is sent without a preflight.
 *
 * For unsafe methods:
 *   - an `Origin` header must be one of the configured web origins (CORS_ORIGINS);
 *   - without `Origin`, a browser `Sec-Fetch-Site: cross-site` request is rejected.
 * Requests with neither header come from non-browser clients, which cannot be CSRF victims.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (origin !== undefined) {
    if (!env.corsOrigins.includes(origin)) {
      throw new AppError('FORBIDDEN', 'Request origin is not allowed');
    }
    return next();
  }

  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new AppError('FORBIDDEN', 'Cross-site requests are not allowed');
  }
  next();
}
