# ASRA Academy — Post-Launch Monitoring (PHASE 18)

Version 0.1.0 · 2026-10-30 · Incidents: [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md), [PRODUCTION-INCIDENT-LOG.md](./PRODUCTION-INCIDENT-LOG.md) · Report: [POST-LAUNCH-REPORT.md](./POST-LAUNCH-REPORT.md)

## Status: **NO ACTIVE ALERTING**

Nothing is watching production right now. One free availability probe has been written and will start only after it is merged to `main` (§3). Everything else in this document is a manual check an operator must choose to run.

The platform has not launched: UAT has not started, client acceptance is pending, and search indexing is off ([PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) §2).

## 1. Coverage, signal by signal

| Signal                       | What exists today                                                                                    | Automatic alert? | Gap                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| Availability (public)        | `scripts/production-probe.mjs`: API liveness and readiness, public catalogue, web home and catalogue | After merge      | Hourly, so up to about an hour to detect. GitHub may delay scheduled runs                   |
| Anonymous access to admin    | Same probe expects 401 from `/api/v1/admin/dashboard`                                                | After merge      | One route only                                                                              |
| HTTP 5xx                     | Request log (`httpStatus`), runtime log (`request errored`)                                          | No               | Manual, inside the retention window (§2)                                                    |
| API error rate               | Can be counted from logs by hand                                                                     | No               | No aggregate metric                                                                         |
| Latency and timeouts         | `responseTime` in each API log line; probe timings                                                   | No               | Server time excludes the network and cold start. Vercel dashboard not inspected             |
| Database connection failures | Log `Database unavailable`, `PostgreSQL readiness check failed`                                      | Via probe only   | Slow queries are **not collected**. Neon's own tools not inspected (no session)             |
| Payments and webhooks        | Log `Webhook processing failed`, `Rejected webhook…`; Admin → Payments                               | No               | **Not applicable yet:** Razorpay is not configured                                          |
| Email delivery failures      | Log `Email delivery failed`, `Notification email failed`; Admin → Email deliveries                   | No               | Delivery never verified (B5). Failed notification emails are not retried on Vercel          |
| Authentication errors        | 401/403 lines at pino level 40; `Refresh-token reuse detected — session revoked`                     | No               | No rate view                                                                                |
| Background jobs              | None run on Vercel (no queue; `server.ts` workers never start; no cron defined)                      | No               | Nothing to monitor, and nothing retries (PRODUCTION-DEPLOYMENT §5)                          |
| Crashes, resource exhaustion | Vercel platform                                                                                      | No               | The `uncaughtException` handlers live in `server.ts`, which does not run on Vercel          |
| Critical user journeys       | Public pages only                                                                                    | Partly           | Sign-in and learning are unmonitored: no production smoke accounts exist                    |
| Browser errors, field vitals | Nothing                                                                                              | No               | Needs an approved tool (U-05, AH-07). Web runtime logs were empty in the observation window |

There is no Sentry or other error tracker in the code or dependencies, and no alert owner has been named.

## 2. Reading the logs correctly

**Retention is the main limit.** The team `arry043s-projects` is on Vercel's **Hobby** plan. Measured on 2026-10-30:

| Source                                | Accepted                     | Refused                                                                             |
| ------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Runtime logs (`vercel logs`)          | `--since 30m`, `--since 45m` | `--since 1h`, `--since 2h` ("hobby plan does not retain…"). Vercel documents 1 hour |
| Request logs (`vercel logs requests`) | `--since 3h`                 | `--since 24h` ("require Observability Plus, a Priority project, or Enterprise")     |

An error is gone within about an hour. **Evidence must be captured while an incident is happening**, and nothing can be investigated the next morning.

**Do not filter on Vercel's level.** The API writes all pino output to stdout, so Vercel labels it `info`, whatever its real severity. The only `error` lines in the observation window were a harmless Node SSL warning printed on each new instance.

| Log line                                       | Pino level | Vercel `level` |
| ---------------------------------------------- | ---------- | -------------- |
| `request errored` (a real 503)                 | 50 (error) | `info`         |
| `PostgreSQL readiness check failed`            | 40 (warn)  | `info`         |
| `(node:8) Warning: SECURITY WARNING: The SSL…` | not pino   | `error`        |

Commands tested against production on 2026-10-30:

```bash
S="--scope arry043s-projects"
vercel logs requests -p api-asra-academy $S --since 1h --query 'httpStatus >= 500'   # 5xx responses
vercel logs -p api-asra-academy $S --since 30m --query 'request errored'             # 5xx, with request ID
vercel logs -p api-asra-academy $S --since 30m --query 'readiness check failed'      # which dependency
vercel logs -p api-asra-academy $S --since 30m --query 'Redis'                       # Redis problems
vercel logs -p api-asra-academy $S --since 30m --query 'in-memory fallback'          # limiter without Redis
```

These return nothing useful, so do not use them: `--query 'level:error'` (SSL warning only) and `--query '"level":50'` (rejected as invalid).

Other messages in §1 can be searched the same way, by their exact text. Log lines can carry user IDs and URLs: paste only the sanitized fields (time, route, status, error class, request ID) into an incident record.

## 3. Alert A1 — production probe

This is the only alert that can run on the current plan without paying for anything. The repository is public, so its Actions minutes are free.

| Field          | Definition                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Written, not active.** Starts when `.github/workflows/production-probe.yml` reaches `main`                                                               |
| Condition      | Any check fails 3 attempts, 20 s apart (see the table below)                                                                                               |
| Evaluation     | Hourly at minute 17 (best effort), plus manual `workflow_dispatch`                                                                                         |
| Severity       | Depends on the check that failed (see the table below)                                                                                                     |
| Notification   | GitHub's failed-workflow email to whoever last changed the workflow's `cron` line, if their Actions notifications are on. **Confirm that person gets one** |
| Owner          | `<to be named>`                                                                                                                                            |
| First response | Open the run's summary, then re-run `npm run probe:production`, then §2, then [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)                               |
| Escalation     | Operator → Release manager → Academy contact (all `<to be named>`, PRODUCTION-DEPLOYMENT §7)                                                               |

| Failed check                     | Starting severity | Look at                                                                   |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| API refuses anonymous admin      | **P0**            | Treat as a security incident until disproved. ROLLBACK-RUNBOOK §2         |
| API readiness (database, Redis)  | P1                | Which dependency is down: `readiness check failed`; Neon and Redis status |
| API liveness                     | P1                | Vercel status, latest deployment, runtime logs                            |
| API public catalogue             | P1                | `request errored`, `Database unavailable`                                 |
| Web home or web course catalogue | P1                | Vercel status, latest web deployment                                      |

Three things to know about running it:

- **It wakes the database.** Each run can resume Neon if it has scaled to zero. Estimate, not a measurement: hourly runs at a 5-minute suspend delay would be about 2 active hours a day. A small Neon plan could feel this, so the schedule stays hourly until the plan is known (B7). Tighten it to `*/15` at launch if the plan allows.
- **GitHub disables schedules in public repositories after 60 days without activity.** A quiet repository silently loses this alert. Check the Actions tab monthly.
- **Making the repository private** (recommended, see POST-LAUNCH-REPORT §8) would start consuming the Actions minutes allowance: about 720 billed minutes a month at this schedule.

Run it by hand at any time, including from a laptop during an incident:

```bash
npm run probe:production
```

It sends only `GET` requests, prints only status and timing, and exits 1 on failure. Both paths were tested on 2026-10-30, the failure path against a local server returning 503 and an unprotected admin route.

**Reading readiness.** Before the fix for INC-2026-001 is deployed, the first readiness check on a new instance is often a false 503, so the probe's retries will show `503, then 200`. That is not an alert. A single failure can also come from a slow database resume (INC-2026-002).

## 4. Alerts proposed for later (not active)

These cannot be automated today because no tool receives the signal and logs expire within an hour. They need a decision on a paid plan, log drain or error tracker. Thresholds are starting points: there is no real traffic yet to set a baseline from, so review them after 2 weeks of real use.

| ID  | Condition (window)                                         | Severity | Investigate                                | Needs                       |
| --- | ---------------------------------------------------------- | -------- | ------------------------------------------ | --------------------------- |
| A2  | 5xx share above 5%, at least 20 requests (10 min)          | P1       | `request errored`, group by route          | Log drain or error tracker  |
| A3  | Any `Unhandled error` line (per occurrence)                | P2       | Request ID, error class                    | Error tracker               |
| A4  | `Database unavailable` 5 or more times (5 min)             | P1       | Neon status, connection count              | Log drain                   |
| A5  | Any `Refresh-token reuse detected` burst, 10 or more (1 h) | P1       | Possible token theft; SECURITY.md          | Log drain                   |
| A6  | `Webhook processing failed`, any (per occurrence)          | P1       | Admin → Payments; PAYMENTS §10             | Log drain, payments enabled |
| A7  | Rejected webhook signature, 3 or more (15 min)             | P1       | Wrong secret, or forged calls              | Log drain, payments enabled |
| A8  | `Email delivery failed`, 3 or more (1 h)                   | P2       | Admin → Email deliveries; Resend dashboard | Log drain                   |

Owner and escalation for all: as A1.

## 5. Manual checks until alerting exists

| When                                 | Check                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| After every production deployment    | PRODUCTION-SMOKE-TESTS §2, then ROLLBACK-RUNBOOK §1 step 7                                 |
| Each working day once users are live | Admin → Email deliveries for stuck `PENDING` or failed rows; Admin → Payments once enabled |
| Monthly                              | Workflow still enabled; TLS expiry (currently 2027-01-13, Vercel renews); `npm audit`      |
