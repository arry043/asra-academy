# ASRA Academy — Production Deployment (PHASE 17)

Version 0.1.0 · Reviewed 2026-10-28 · Environment: [PRODUCTION-ENVIRONMENT.md](./PRODUCTION-ENVIRONMENT.md) · Database: [DATABASE-BACKUP-AND-RECOVERY.md](./DATABASE-BACKUP-AND-RECOVERY.md) · Smoke tests: [PRODUCTION-SMOKE-TESTS.md](./PRODUCTION-SMOKE-TESTS.md) · Rollback: [ROLLBACK-RUNBOOK.md](./ROLLBACK-RUNBOOK.md)

## Status: **DEPLOYED, NOT RELEASE-READY**

The web app and API are **already running in production** at the real domain. They were deployed automatically by Vercel's Git integration when PR #19 was merged to `main` (commit `d6ca7c7`, 2026-10-28 ~13:09 IST). **Phase 17 did not deploy anything and made no production change.** It audited what is live, ran the release gates, and recorded the blockers below.

Health checks pass and the public site works. The platform is **not** ready for launch (search indexing, real students, paid courses) until the blockers in §4 are resolved. Client acceptance is still **Pending client sign-off** ([CLIENT-ACCEPTANCE.md](./CLIENT-ACCEPTANCE.md)).

## 1. Architecture as deployed

```text
Internet
   |
GoDaddy DNS (ns63/ns64.domaincontrol.com) — no Cloudflare, no CDN/WAF in front of Vercel
   |
   +-- asraacademy.in  ──308──►  www.asraacademy.in
   |
   +--------------------------------+-----------------------------------+
   |                                                                    |
www.asraacademy.in                                          api.asraacademy.in
Vercel project "asra-academy"                               Vercel project "api-asra-academy"
Next.js 16, root apps/web, Node 24.x, iad1                  Express preset (serverless), root apps/api, Node 22.x, iad1
TLS: Let's Encrypt (Vercel), valid to 2027-01-13            TLS: Let's Encrypt (Vercel), valid to 2027-01-13
   |                                                                    |
   +------------- browser calls API directly (same-site) ---------------+
                                                                        |
                                                   Neon PostgreSQL (DATABASE_URL / DIRECT_DATABASE_URL)
                                                   Redis (REDIS_URL — rate limits; readiness "up")

External integrations (production):
  Email ........ Resend — transport configured; sender domain DKIM record present; delivery NOT verified
  Payments ..... Razorpay — NOT configured (online checkout disabled by design)
  Google Meet .. NOT configured (faculty paste meeting links manually)
  Storage ...... not implemented (R-01)
  WhatsApp ..... not configured / not approved (P-02, P-03)
  Monitoring ... none (no Sentry or equivalent); Vercel runtime logs only
  Analytics .... none (U-05, AH-07)
```

Differences from the target architecture in the Phase 17 brief:

| Target              | Actual                         | Consequence                                                                                                                     |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare in front | GoDaddy DNS straight to Vercel | No WAF/CDN layer. `trust proxy = 1` is **correct** for this topology (SECURITY.md §6.2) — do not change unless a proxy is added |
| Storage             | Not implemented                | No file uploads exist to secure                                                                                                 |
| Error monitoring    | None                           | Errors visible only in Vercel logs; no alerting (§4, B6)                                                                        |
| Long-running API    | Serverless functions           | Background sweeps do not run (§5)                                                                                               |

Deployment workflow (as configured in Vercel, not in the repository):

- **Trigger:** push/merge to `main` → Production for both projects; other branches → Preview (protected by Vercel Authentication).
- **Web build:** `cd ../.. && npm run build:packages && npm run build -w @asra/web`; install `npm install --include=dev`.
- **API build:** `cd ../.. && npm run build:packages && npm run build -w @asra/api` (Prisma generate + `tsc`); entry is the default export of `apps/api/src/app.ts`.
- **Migrations are not part of the build.** They are applied by an operator with `npm run db:migrate:deploy` (§3).
- **CI:** `.github/workflows/ci.yml` runs format, lint, Prisma validate/generate, typecheck, web tests, build on pushes/PRs to `main`/`develop`. API integration tests are **not** in CI (need PostgreSQL/Redis); they are run locally.

## 2. Release gate (2026-10-28)

| Gate                                        | Result                                                                                                 | Evidence                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Format / lint / Prisma validate / typecheck | Pass                                                                                                   | Local run on working tree (= `d6ca7c7` code; only docs differ) |
| Production build (API + web)                | Pass                                                                                                   | `npm run build`; Vercel production builds Ready                |
| API tests                                   | **431 / 431 pass** (117 suites)                                                                        | `npm test` against local `asra_academy_test`                   |
| Web tests                                   | **192 / 192 pass**                                                                                     | `npm test -w @asra/web`                                        |
| Dependency audit                            | 5 findings (4 high, 1 moderate), Prisma CLI only                                                       | Unchanged; accepted SEC-10                                     |
| Migrations reviewed                         | No schema change between the previous production commit (`6ecadd0`) and `d6ca7c7`; 10 migrations total | `git diff 6ecadd0 d6ca7c7 -- apps/api/prisma` empty            |
| P0 defects                                  | None                                                                                                   | QA-DEFECT-LOG                                                  |
| P1 defects                                  | QA-DEF-03 fixed and merged; **AI-01 sign-off not recorded**                                            | CLIENT-CLARIFICATIONS AI-01                                    |
| UAT / client acceptance                     | **Not started / Pending client sign-off**                                                              | UAT-PLAN, CLIENT-ACCEPTANCE                                    |
| Critical integrations                       | Email unverified; Razorpay, Meet not configured                                                        | §4                                                             |
| Rollback documented                         | Yes                                                                                                    | ROLLBACK-RUNBOOK                                               |

**Gate decision: FAIL for launch.** Missing UAT sign-off and unverified critical configuration are not treated as approved. The existing deployment is suitable only as a non-indexed pre-launch / UAT target once B1–B3 are fixed.

## 3. Migration procedure (for future releases)

1. Read the new migration SQL in the PR. Flag `DROP`, `ALTER … TYPE`, `NOT NULL` without default, unique indexes on large tables, and long-locking operations. Prefer expand-then-contract (additive first, remove later).
2. Create a Neon recovery point (branch) immediately before — see DATABASE-BACKUP-AND-RECOVERY §3.
3. From an operator shell with **only** the production `DIRECT_DATABASE_URL` set (copied from the secret manager, never written to a file in the repo):
   ```bash
   npm run db:migrate:status     # confirm target and pending list
   npm run db:migrate:deploy     # never migrate reset / db push against production
   npm run db:seed               # only when the release notes say so (additive role/permission grants)
   ```
4. Order: **migrate first, then merge/deploy** the code, for additive migrations. For a migration the old code cannot run against, plan a maintenance window and record that a simple code rollback is no longer possible.
5. Verify `GET /api/v1/health/ready` → `database: up`, then the smoke tests.

## 4. Blockers and operator actions

None of these were performed in Phase 17. Each needs explicit authorisation (and, where noted, client input).

| #   | Severity      | Finding                                                                                                                                                                                                                                                 | Required action                                                                                                                                                                                                                                                               | Owner                        |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| B1  | **High**      | API env vars `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, `REDIS_URL` (and the rest) are scoped to **Production and Preview**. Every preview deployment of any branch runs against the **production database** with the production signing key. | Give Preview its own Neon branch/DB, Redis and `JWT_SECRET` (PRODUCTION-ENVIRONMENT §4). Then rotate the production `JWT_SECRET` (signs everyone out once).                                                                                                                   | Operator, with authorisation |
| B2  | **High**      | Test content is live on the public site: course **"Cyber Security Master"** (slug `cyber-security-master`, published, Public) with a thumbnail hot-linked from a third-party site (lpu.in).                                                             | Academy/admin decides: unpublish/archive via the admin portal (no direct DB edit). Public catalogue may cache up to 60 s.                                                                                                                                                     | Client / admin               |
| B3  | Medium        | `ENABLE_DESIGN_SYSTEM` is set on the production web project; `/design-system` is publicly reachable (200). README: "leave empty (showcase returns 404)".                                                                                                | Remove from Production, redeploy web.                                                                                                                                                                                                                                         | Operator, with authorisation |
| B4  | Medium        | Canonical origin mismatch: `NEXT_PUBLIC_APP_URL` is the apex `https://asraacademy.in`, but Vercel redirects the apex to `www`. Canonical tags, sitemap and email links point at a redirecting URL.                                                      | Choose one canonical host. Either set `NEXT_PUBLIC_APP_URL=https://www.asraacademy.in` on **both** projects (and add it to `CORS_ORIGINS`), or make the apex the primary domain in Vercel. Redeploy web (build-time value). Must be done before `SITE_INDEXING_ENABLED=true`. | Client decision + operator   |
| B5  | High (launch) | Email delivery not verified: `EMAIL_FROM` value and Resend domain status not confirmed (a DKIM record for Resend exists on the domain). Registration needs a working verification email.                                                                | Confirm in Resend that the domain is _Verified_ and `EMAIL_FROM` uses it; one safe test (password reset to a team mailbox).                                                                                                                                                   | Client + operator            |
| B6  | Medium        | No error monitoring or alerting.                                                                                                                                                                                                                        | Choose a provider (e.g. Sentry) — requires a code change, DSN and a privacy-notice entry (AH-07) — or at minimum an external uptime check on `/api/v1/health/ready` with an owner.                                                                                            | Client decision              |
| B7  | Medium        | Backups / point-in-time recovery not verified (Neon CLI session expired; plan unknown).                                                                                                                                                                 | Re-authenticate, record plan and history-retention window, create a named pre-launch branch (DATABASE-BACKUP-AND-RECOVERY).                                                                                                                                                   | Operator                     |
| B8  | Low           | Node version: API 22.x vs web 24.x and `.nvmrc` 24.                                                                                                                                                                                                     | Set API project to 24.x on the next planned deploy (tests ran on Node 22 and 24 environments locally/CI).                                                                                                                                                                     | Operator                     |
| B9  | Launch        | Paid courses: no Razorpay keys. Live mode needs KYC, test-mode verification on staging (AI-02) and UAT.                                                                                                                                                 | Do not add live keys until AI-02 and UAT pass.                                                                                                                                                                                                                                | Client                       |
| B10 | Launch        | UAT not started; acceptance pending; AI-01 … AI-06 and minors/privacy items (AH-01, E-01 … E-05, U-01) undecided.                                                                                                                                       | UAT-PLAN.                                                                                                                                                                                                                                                                     | Client                       |
| B11 | Launch        | `SITE_INDEXING_ENABLED` empty — correct until B2, B4, U-01 and acceptance are done.                                                                                                                                                                     | Enable only at launch, then redeploy web.                                                                                                                                                                                                                                     | Operator, at launch          |

## 5. Production limitations (serverless)

On Vercel the API runs as functions, so `server.ts` (and its workers) never starts:

- **Exam/quiz expiry sweep** — not run; expired attempts are finalized when next touched (correctness preserved).
- **Payment reconciliation sweep** — not run; recovery relies on Razorpay webhooks and "Check payment status" (PAYMENTS §10). Relevant only once payments are enabled.
- **Notification email retry sweep** — not run; an email whose first send fails stays `PENDING` (visible in Admin → Email deliveries) until a future sweep (AE-09).
- **Graceful shutdown** — handled by the platform; the app's SIGTERM handler is not used.

Remedy (change request, not done): a protected cron endpoint invoked by Vercel Cron, or a small long-running worker.

## 6. Observability (as found)

| Capability                  | Status                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Structured logs             | Yes — pino JSON, one line per request, secrets redacted (`lib/logger.ts`); in Vercel runtime logs (retention per Vercel plan) |
| Request correlation         | Yes — `X-Request-Id` accepted/generated and returned                                                                          |
| Liveness / readiness        | `GET /api/v1/health` · `GET /api/v1/health/ready` (database + Redis)                                                          |
| Database connectivity       | Readiness only; no external monitor                                                                                           |
| Payment / webhook failures  | Admin → Payments; logs. N/A until payments enabled                                                                            |
| Email failures              | Admin → Email deliveries                                                                                                      |
| Error monitoring / alerting | **None** (B6)                                                                                                                 |
| Resource / latency          | Vercel dashboard (Observability) only                                                                                         |
| Alert ownership             | `<to be named>`                                                                                                               |

## 7. Escalation

| Role                   | Responsibility                         | Person          |
| ---------------------- | -------------------------------------- | --------------- |
| Release manager        | Go/no-go, rollback decision            | `<to be named>` |
| Vercel / Neon operator | Deploy, rollback, recovery             | `<to be named>` |
| Academy contact (X-05) | Business decisions, user communication | `<to be named>` |
| Payment account owner  | Razorpay dashboard                     | `<to be named>` |
