import { z } from 'zod';
import { emailSchema } from './common.js';

/**
 * Password policy (docs/AUTHENTICATION.md §Password policy), following NIST SP 800-63B and the
 * OWASP Authentication Cheat Sheet: length is what matters, so there are NO composition rules
 * (no forced upper-case/digit/symbol). Any Unicode character, including spaces, is allowed.
 *  - minimum 10 characters — pending client confirmation (CLIENT-CLARIFICATIONS D-06)
 *  - maximum 128 characters — bounds Argon2 hashing cost per request (DoS protection)
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((value) => value.trim().length > 0, 'Password cannot be only spaces');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(150, 'Name must be at most 150 characters');

/**
 * Public self-registration. `.strict()` rejects unknown keys, so a client cannot smuggle in
 * `role`, `roles`, `status` or similar — every self-registered account is a STUDENT.
 */
export const registerSchema = z
  .object({ fullName: fullNameSchema, email: emailSchema, password: passwordSchema })
  .strict();

/** Login accepts any non-empty password up to the max: policy is enforced at registration. */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export const emailOnlySchema = z.object({ email: emailSchema }).strict();

/** Emailed one-time tokens: 32 random bytes, base64url-encoded (43 characters). */
export const oneTimeTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'This link is invalid or has expired');

export const verifyEmailSchema = z.object({ token: oneTimeTokenSchema }).strict();

export const resetPasswordSchema = z
  .object({ token: oneTimeTokenSchema, password: passwordSchema })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
