import type { PermissionKey, UserRole } from '@asra/types';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';

/**
 * Route-level authorization. Must run after `authenticate`:
 *   router.get('/admins', authenticate, requireRole('SUPER_ADMIN'), controller.list)
 *
 * 401 = not authenticated (no `req.auth`); 403 = authenticated but not allowed.
 * These check broad capability only — resource ownership/assignment is checked in services
 * via `accessPolicy` (see access-policy.service.ts).
 */

/** Allows the request if the user has ANY of the listed roles. */
export function requireRole(...roles: [UserRole, ...UserRole[]]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new AppError('UNAUTHORIZED', 'Authentication required');
    if (!roles.some((role) => req.auth?.roles.has(role))) {
      throw new AppError('FORBIDDEN', 'You do not have access to this resource');
    }
    next();
  };
}

/** Allows the request only if the user has ALL of the listed permissions. */
export function requirePermission(...permissions: [PermissionKey, ...PermissionKey[]]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new AppError('UNAUTHORIZED', 'Authentication required');
    if (!permissions.every((permission) => req.auth?.permissions.has(permission))) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
}
