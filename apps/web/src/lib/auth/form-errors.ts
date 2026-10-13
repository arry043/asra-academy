import type { z } from 'zod';
import { ApiClientError } from '@/lib/api';

export type FieldErrors = Record<string, string>;

/**
 * Validates with the SAME Zod schema the API uses (`@asra/validation`), returning parsed data or
 * field → first message.
 */
export function validateForm<T extends z.ZodType>(
  schema: T,
  values: unknown,
): { data: z.infer<T>; errors?: undefined } | { data?: undefined; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
  }
  return { errors };
}

/** Maps any thrown error to a user-facing message plus server-side field errors. */
export function describeError(error: unknown): { message: string; fieldErrors: FieldErrors } {
  if (error instanceof ApiClientError) {
    return { message: error.message, fieldErrors: error.fieldErrors };
  }
  return { message: 'Something went wrong. Please try again.', fieldErrors: {} };
}
