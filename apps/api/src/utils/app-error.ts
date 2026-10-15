import type { ApiErrorCode } from '@asra/types';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_DISABLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** One field-level problem, shaped like a Zod issue so clients read both the same way. */
export interface FieldErrorDetail {
  path: string[];
  message: string;
  code?: string;
}

/**
 * An error about one request field, e.g. a duplicate slug (409) or an inactive relation (422).
 * `details` uses the Zod issue shape, so the web client maps it onto the form field.
 */
export function fieldError(
  code: 'VALIDATION_ERROR' | 'CONFLICT',
  field: string,
  message: string,
): AppError {
  return new AppError(code, message, [{ path: [field], message }] satisfies FieldErrorDetail[]);
}

/** Operational error that is safe to expose to API clients. */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }
}
