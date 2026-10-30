#!/usr/bin/env node
/**
 * Read-only production probe (docs/POST-LAUNCH-MONITORING.md). GET requests only: it creates no
 * record, signs nobody in and sends no email. Prints status and timing, never a response body.
 * Exits 1 when a check fails, which is what makes the scheduled workflow notify its owner.
 *
 *   npm run probe:production
 *
 * PROBE_API_URL / PROBE_WEB_URL point it at another environment.
 */
import { appendFileSync } from 'node:fs';

const API = (process.env.PROBE_API_URL ?? 'https://api.asraacademy.in').replace(/\/$/, '');
const WEB = (process.env.PROBE_WEB_URL ?? 'https://www.asraacademy.in').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 30_000;
// A new function instance or a resuming Neon database can miss the readiness budget once. An
// alert must mean "still failing", so a check only fails after every attempt has.
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 20_000;

/** The body is read only by checks that need it, and is never printed. */
const CHECKS = [
  { name: 'API liveness', url: `${API}/api/v1/health`, expect: 200 },
  {
    name: 'API readiness (database, Redis)',
    url: `${API}/api/v1/health/ready`,
    expect: 200,
    verify: (body) => body.includes('"database":"up"') && body.includes('"redis":"up"'),
  },
  { name: 'API public catalogue', url: `${API}/api/v1/courses`, expect: 200 },
  // A 200 here would mean anonymous visitors can read admin data: the alert to wake someone for.
  { name: 'API refuses anonymous admin', url: `${API}/api/v1/admin/dashboard`, expect: 401 },
  { name: 'Web home', url: `${WEB}/`, expect: 200 },
  { name: 'Web course catalogue', url: `${WEB}/courses`, expect: 200 },
];

async function attempt(check) {
  const startedAt = performance.now();
  try {
    const response = await fetch(check.url, {
      headers: { 'User-Agent': 'asra-production-probe/1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    const ok = response.status === check.expect && (check.verify?.(body) ?? true);
    return { ok, status: response.status, ms: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      ok: false,
      status: error.name === 'TimeoutError' ? 'timeout' : 'network error',
      ms: Math.round(performance.now() - startedAt),
    };
  }
}

async function run(check) {
  const attempts = [];
  for (let n = 1; n <= ATTEMPTS; n++) {
    const result = await attempt(check);
    attempts.push(result);
    if (result.ok) break;
    if (n < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return { check, attempts, ok: attempts.at(-1).ok };
}

const results = await Promise.all(CHECKS.map(run));

const rows = results.map(({ check, attempts, ok }) => {
  const seen = attempts.map(({ status, ms }) => `${status} in ${ms} ms`).join(', then ');
  return `| ${ok ? 'pass' : 'FAIL'} | ${check.name} | ${check.expect} | ${seen} |`;
});
const report = [
  `Probe ${new Date().toISOString()}`,
  '',
  '| Result | Check | Expected | Observed |',
  '| ------ | ----- | -------- | -------- |',
  ...rows,
  '',
].join('\n');

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

process.exit(results.every(({ ok }) => ok) ? 0 : 1);
