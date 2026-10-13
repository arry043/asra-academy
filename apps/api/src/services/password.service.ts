import * as argon2 from 'argon2';

/**
 * Argon2id parameters — OWASP Password Storage Cheat Sheet baseline (m=19 MiB, t=2, p=1).
 * The parameters are embedded in each hash, so they can be raised later: `needsRehash` then
 * upgrades a user's hash transparently on their next successful login.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Precomputed at startup and verified against when an email is unknown, so a login for a
 * non-existent account takes as long as one with a wrong password (no timing oracle).
 */
const dummyHashPromise = argon2.hash('asra-timing-equaliser-not-a-real-password', HASH_OPTIONS);

export const passwordService = {
  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  },

  /** Returns false (never throws) for a wrong password or a malformed stored hash. */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, HASH_OPTIONS);
  },

  /** Burns the same CPU/memory as a real verification. Always resolves to false. */
  async verifyDummy(password: string): Promise<false> {
    await passwordService.verify(await dummyHashPromise, password);
    return false;
  },
};
