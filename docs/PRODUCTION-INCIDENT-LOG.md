# ASRA Academy — Production Incident Log (PHASE 18)

Version 0.1.0 · 2026-10-30 · Procedure: [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)

Real events only. This repository is public, so entries hold sanitized facts: no personal data, tokens, connection strings or raw logs. All times are UTC.

## Summary

| Severity | Total | Open | Fixed, not deployed | Closed |
| -------- | ----- | ---- | ------------------- | ------ |
| P0       | 0     | 0    | 0                   | 0      |
| P1       | 0     | 0    | 0                   | 0      |
| P2       | 0     | 0    | 0                   | 0      |
| P3       | 2     | 1    | 1                   | 0      |

**Limit of this count:** it covers only the observation window of 2026-10-30, 10:41–11:14. Earlier incidents cannot be ruled out: there was no monitoring, and logs last about an hour. Severities are proposed by engineering, pending the approval of the policy.

## Register

| ID           | Severity | Summary                                            | First observed   | Status              |
| ------------ | -------- | -------------------------------------------------- | ---------------- | ------------------- |
| INC-2026-001 | P3       | False `redis: down` on a new API function instance | 2026-10-30 10:58 | Fixed, not deployed |
| INC-2026-002 | P3       | Readiness database check timed out once at 2 s     | 2026-10-30 10:41 | Monitoring          |

## Entries

### INC-2026-001 — Readiness reports Redis down on a new function instance

- **Status:** Fixed, not deployed
- **Severity:** P3, proposed by engineering. Service was not affected as far as the evidence shows, but this false alarm would make any monitor unreliable and can meet the rollback trigger "`/health/ready` not up" if it recurs.
- **First observed / last observed:** 2026-10-30 10:58:34 / 11:12:16 (3 occurrences). It has probably existed since the first Vercel deployment; logs from then no longer exist.
- **Affected service and route:** API, `GET /api/v1/health/ready`, deployment `dpl_BD3dq2xns2QrUPDw7m7UH1xgLFT2` (commit `10f4bd1`)
- **Impacted users or workflow:** No user workflow known. Readiness only.
- **Evidence:** `redis=down, HTTP 503`, followed by `redis=up, HTTP 200` on the next request, each time. Log line at pino level 40: `Redis readiness check failed`, error `Stream isn't writeable and enableOfflineQueue options is false`.
- **Reproduction:** Locally, loaded the app without `server.ts` and called the readiness service: first call `redis: down`, second `redis: up`.
- **Root cause (confirmed by log message, code and reproduction):** `connectRedis()` is called only from `server.ts`, which never runs on Vercel. The client uses `lazyConnect` with `enableOfflineQueue: false`, so a `PING` sent before the connection is ready is refused immediately.
- **Mitigation:** The production probe retries before it fails.
- **Permanent fix:** `pingRedis()` in `apps/api/src/lib/redis.ts` waits for the connection (within the existing 2 s budget) and then pings; `health.service.ts` uses it. Other Redis callers are unchanged.
- **Regression test:** `apps/api/tests/redis-readiness.test.ts`
- **Deployment and retest:** **Pending.** After deployment: leave the API idle for at least 10 minutes, request readiness once, and expect `redis: up`. Repeat 3 times.
- **Follow-up:** The rate limiter has the same not-ready window, and may count the first requests of a new instance in memory instead of Redis (hypothesis). This did not reproduce locally, where Redis connects faster than a remote TLS connection, and was not tested in production. After deployment, check `--query 'in-memory fallback'` once real sign-ins occur.

### INC-2026-002 — Readiness database check timed out once

- **Status:** Monitoring
- **Severity:** P3, proposed by engineering. A single event, and real queries succeeded seconds later.
- **First observed / last observed:** 2026-10-30 10:41:18 (1 occurrence)
- **Affected service and route:** API, `GET /api/v1/health/ready`, same deployment
- **Impacted users or workflow:** None known.
- **Evidence:** `database: down, redis: up`, HTTP 503. Log: `PostgreSQL timed out after 2000ms`. Six readiness checks about 2 minutes later reported `database: up`, and `/api/v1/courses` returned 200 in 829 ms on a new instance 6 s after the failure.
- **Reproduction:** Not reproduced. Later samples, 6–15 minutes after the previous request, did not time out on the database: those requests took 1.05–1.21 s in the function. Whether the database had suspended in those gaps is unknown.
- **Root cause:** Confirmed only that the 2 s readiness budget was exceeded. **Hypothesis:** the first connection on a database resuming from scale-to-zero. Neon's plan and suspend setting are unverified (B7). Application queries allow a 10 s connection timeout, which would explain why real requests are less exposed.
- **Mitigation:** The production probe retries 3 times over 40 s.
- **Permanent fix:** None. A single sample does not justify changing the timeout.
- **Regression test:** Not applicable.
- **Deployment and retest:** Not applicable.
- **Follow-up:** Once the probe is running, read its history. If first-attempt database failures are common, raise the readiness budget. Confirm the Neon suspend setting (B7).
