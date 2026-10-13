import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of entropy, base64url-encoded (43 characters). Used for refresh and one-time tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 hex digest used to store tokens. A fast hash is appropriate here (unlike passwords):
 * the tokens are 256-bit random values, so brute-forcing the digest is infeasible.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
