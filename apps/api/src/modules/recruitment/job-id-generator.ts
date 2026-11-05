import type { DbClient } from '../../database/types.js';

/**
 * Concurrency-safe, atomic, year-based Job ID generator.
 * Format: `ASRA-JOB-YYYY-XXXXX` (e.g. `ASRA-JOB-2026-00001`)
 *
 * Uses PostgreSQL's `INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING current_val`
 * which is strictly serialized, atomic, gapless, and safe under concurrent requests.
 */
export async function generateJobId(
  db: DbClient,
  year = new Date().getFullYear(),
): Promise<string> {
  const result = await db.$queryRaw<Array<{ current_val: number }>>`
    INSERT INTO "job_sequences" ("year", "current_val", "updated_at")
    VALUES (${year}, 1, NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "current_val" = "job_sequences"."current_val" + 1, "updated_at" = NOW()
    RETURNING "current_val";
  `;

  const sequenceNum = result[0]?.current_val ?? 1;
  const padded = String(sequenceNum).padStart(5, '0');
  return `ASRA-JOB-${year}-${padded}`;
}

/**
 * Concurrency-safe, atomic, year-based Application Reference ID generator.
 * Format: `ASRA-APP-YYYY-XXXXX` (e.g. `ASRA-APP-2026-00001`)
 */
export async function generateApplicationReferenceId(
  db: DbClient,
  year = new Date().getFullYear(),
): Promise<string> {
  const result = await db.$queryRaw<Array<{ current_val: number }>>`
    INSERT INTO "application_sequences" ("year", "current_val", "updated_at")
    VALUES (${year}, 1, NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "current_val" = "application_sequences"."current_val" + 1, "updated_at" = NOW()
    RETURNING "current_val";
  `;

  const sequenceNum = result[0]?.current_val ?? 1;
  const padded = String(sequenceNum).padStart(5, '0');
  return `ASRA-APP-${year}-${padded}`;
}
