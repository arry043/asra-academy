import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { toAppError } from '../database/errors.js';
import { sendError } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
  message?: string;
}

/**
 * Central error handler — the only place that turns exceptions into HTTP responses.
 * Express 5 forwards rejected promises from async handlers here automatically.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express identifies error middleware by arity, so `next` must stay in the signature.
  _next: NextFunction,
): void {
  if (res.headersSent) {
    req.log.error({ err: error }, 'Error after response headers were sent');
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', error.issues);
    return;
  }

  // Prisma / PostgreSQL errors → safe API errors (no SQL, constraint names or row values).
  const databaseError = toAppError(error);
  if (databaseError) {
    if (databaseError.code === 'SERVICE_UNAVAILABLE') {
      req.log.error({ err: error }, 'Database unavailable');
    } else {
      req.log.warn({ prismaCode: (error as { code?: string }).code }, databaseError.message);
    }
    sendError(res, databaseError.statusCode, databaseError.code, databaseError.message);
    return;
  }

  // Errors raised by body-parser / http-errors (e.g. malformed JSON, payload too large).
  const httpError = error as HttpLikeError;
  const status = httpError.statusCode ?? httpError.status;
  if (status && status >= 400 && status < 500 && httpError.expose) {
    sendError(res, status, 'BAD_REQUEST', httpError.message ?? 'Bad request');
    return;
  }

  req.log.error({ err: error }, 'Unhandled error');
  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    env.isProduction
      ? 'An unexpected error occurred'
      : error instanceof Error
        ? error.message
        : 'Unknown error',
  );
}
