import { ASSESSMENT_EXPIRY_SWEEP_MS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';
import { sweepExpiredAttempts } from './attempts.core.js';

/**
 * Background finalization of attempts whose deadline passed while nobody was online
 * (docs/ASSESSMENTS.md §7.5). Started by the long-running server (`server.ts`) only.
 *
 * It is a convenience, not a correctness mechanism:
 *   - every attempt read, answer save, submission, faculty view and result publication checks the
 *     stored deadline itself and finalizes on the spot;
 *   - it keeps no state: deadlines live in PostgreSQL, so a restart resumes exactly where it was;
 *   - several instances can run it at once (`FOR UPDATE SKIP LOCKED`; finalization is idempotent).
 *
 * Serverless deployments (Vercel) do not run it; there, unattended expired attempts are finalized
 * the next time anyone (student, faculty, results) touches them.
 */
export function startAttemptExpiryWorker(intervalMs = ASSESSMENT_EXPIRY_SWEEP_MS): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap sweeps
    running = true;
    try {
      await sweepExpiredAttempts();
    } catch (error) {
      // Database briefly unavailable, etc. — the next tick (or the next request) retries.
      const { name, code } = error as { name?: string; code?: string };
      logger.warn({ errorName: name, errorCode: code }, 'Attempt expiry sweep failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
