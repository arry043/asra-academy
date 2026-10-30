# ASRA Academy — Post-Launch Stabilization Report (PHASE 18)

Version 0.1.0 · 2026-10-30 · Monitoring: [POST-LAUNCH-MONITORING.md](./POST-LAUNCH-MONITORING.md) · Incidents: [PRODUCTION-INCIDENT-LOG.md](./PRODUCTION-INCIDENT-LOG.md) · Releases: [RELEASE-LOG.md](./RELEASE-LOG.md) · Usage: [USAGE-ANALYTICS.md](./USAGE-ANALYTICS.md)

## Summary

**The platform has not launched, so this report covers a pre-launch baseline, not a post-launch period.** One real defect was found and fixed in the working tree, but nothing has been deployed. There is still no active alerting. This was a single review on one day, not continuous monitoring, and it does not show that the application is stable.

The most urgent finding is not a bug: production runs on Vercel's Hobby plan, which Vercel restricts to non-commercial use (§8, decision 1).

## 1. Production version and observation period

| Item               | Finding                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Version            | Unversioned pre-launch, commit `10f4bd1`, both Vercel projects Ready. `v1.0.0` not released (RELEASE-LOG) |
| Observation period | 2026-10-30, about 10:41–11:19 UTC. Logs from before that no longer exist                                  |
| Web and API health | Up. Liveness 200 throughout; readiness had 4 transient failures (§3)                                      |
| Database           | Reachable. Migration status **not checked**: no Neon session, credentials deliberately not pulled         |
| Payments, webhooks | Not applicable: Razorpay not configured                                                                   |
| Email              | Delivery still unverified (B5)                                                                            |
| Access used        | Vercel CLI (read-only), public HTTP GETs. No production sign-in, database access or data change           |

Phase 17's findings were re-checked:

| Blocker                                       | State on 2026-10-30                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| B1 Preview shares production database, secret | **Still present.** `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL` scoped to Preview too |
| B2 Test course public                         | **Still present.** `cyber-security-master` is the only public course               |
| B3 `/design-system` public                    | **Still present.** Returns 200                                                     |
| B4 Canonical uses the redirecting apex        | **Still present.** Sitemap uses `https://asraacademy.in/`                          |
| B8 Node version mismatch                      | **Still present.** API 22.x                                                        |
| B5, B6, B7, B9, B10                           | Open. No evidence of change                                                        |
| B11 Indexing off                              | Correct for now. `robots.txt` still `Disallow: /`                                  |

## 2. Monitoring systems and actual coverage

- **Active alerting: none.** No Sentry or equivalent exists, and no owner has been named.
- **Added:** a free read-only production probe with an hourly GitHub workflow. It is **inactive until merged to `main`**, and covers public availability only, not sign-in, learning, email or payments.
- **Logs:** runtime logs last about an hour and request logs about 3 hours, so problems cannot be investigated after the fact.
- **Log trap:** real application errors appear at Vercel level `info`, so the obvious `level:error` filter finds only a harmless warning. Tested queries are in POST-LAUNCH-MONITORING §2.

## 3. Incidents by severity (real records only)

P0: 0 · P1: 0 · P2: 0 · **P3: 2**. These counts cover only the observation window, and earlier events cannot be ruled out.

| ID           | What happened                                          | Root cause                                                                                        | Fix                                        | Regression test                          |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| INC-2026-001 | Readiness returned a false 503, `redis: down`, 3 times | **Confirmed.** No Redis connection is opened on Vercel before the first command, which is refused | `pingRedis()`. **Not deployed**            | `apps/api/tests/redis-readiness.test.ts` |
| INC-2026-002 | Readiness database check exceeded 2 s, once            | **Hypothesis:** database resuming from scale-to-zero. Neon settings unverified                    | None: one sample does not justify a change | Not applicable                           |

No user impact is known from either. The first would have made any future uptime monitor raise false alarms.

Open defects carried from QA are unchanged, including QA-DEF-05 (a 429 or 5xx during refresh signs the user out of the UI). No production evidence of it was seen, so it was left alone.

## 4. Performance and usage

**Usage:** no findings. The in-app analytics need an admin sign-in, and nearly all requests in the window were this review's own (USAGE-ANALYTICS).

**Performance**, measured from one client in India, as small samples rather than trends:

| Measurement                             | Result                  | Notes                                                   |
| --------------------------------------- | ----------------------- | ------------------------------------------------------- |
| First API request after 6–15 min idle   | 4.0 s, 7.1 s, 9.6 s     | Readiness, 3 samples. Server's own time was about 1.1 s |
| Warm API liveness                       | 0.51–0.59 s (5 samples) | Server's own time is about 1 ms                         |
| Warm web `/`, `/about`, `/verify` total | 0.36–0.60 s             | 2 samples each                                          |
| Warm web `/courses` total               | 1.02–1.08 s             | 2 samples                                               |
| Cold web `/courses` total               | 4.6 s, 8.4 s            | Compare Phase 17's 5.4 s                                |

Requests enter at Vercel's Mumbai edge and run in Washington, D.C. (`x-vercel-id: bom1::iad1`). Warm liveness takes about 0.3 s after TLS, against 1 ms in the function, so the distance is the likely main cost. **No optimization was made:** there is no real traffic to justify one, and moving the function without the database could make things worse. Neon's region is unknown.

## 5. Stabilization controls completed

- Readiness defect fixed, with regression test.
- Production probe and workflow written, and both pass and fail paths tested.
- Monitoring coverage, tested log queries, incident procedure, incident log, usage inventory and release log documented.
- Rollback runbook corrected on log filtering.

## 6. Patch releases: prepared 1, deployed 0

The readiness fix is recorded in RELEASE-LOG. Verification on 2026-10-30, on the working tree:

| Check                                | Result                                                |
| ------------------------------------ | ----------------------------------------------------- |
| Local reproduction, before and after | Before: first check `redis: down`. After: `redis: up` |
| API tests                            | **436 / 436 pass** (431 before, plus 5 new)           |
| Web tests                            | **192 / 192 pass**                                    |
| Lint, typecheck, production build    | Pass                                                  |
| E2E                                  | Not run: the change touches no user journey           |
| Staging                              | **Not done:** no staging environment exists           |
| Production retest                    | **Pending deployment** (INC-2026-001)                 |

## 7. Rollback or recovery actions

None taken, and none needed. Backups and restore remain **unverified** (B7), so recovery cannot currently be relied upon.

## 8. Outstanding risks and client decisions

Decisions, most urgent first:

| #   | Decision                                                                                                                                                                                                                                                | Recommendation                                                                                                                                                                             | Owner            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | **Vercel plan.** Team plan is `hobby`. Vercel's fair-use guidelines restrict Hobby to non-commercial personal use and list requesting payment from visitors, advertising a product or service, and being paid to build or host a site as commercial use | Move to Pro before launch, and before enabling payments. Besides compliance, this removes the risk of the host acting against the account. Check the log limits again after moving         | Client, operator |
| 2   | **Public repository.** It exposes SECURITY.md, the open-blocker list (including B1) and this incident log                                                                                                                                               | Make it private before launch. Actions minutes then count against the allowance (about 720 a month for the probe). No secret was found tracked: `.env` is ignored. History was not scanned | Client, operator |
| 3   | **B1: Preview uses the production database and signing key.** Any branch deployment can write to production data                                                                                                                                        | Fix first among the technical items, then rotate `JWT_SECRET`                                                                                                                              | Operator         |
| 4   | **Name the owners** for alerts and incidents, and agree response targets (INCIDENT-RESPONSE §3–4)                                                                                                                                                       | Needed before an alert means anything                                                                                                                                                      | Client, MTW      |
| 5   | **Error tracking** (B6). Log drains or a tracker would let the proposed alerts A2–A8 work                                                                                                                                                               | Decide with #1, since the plan affects the options. Needs a privacy-notice entry (AH-07)                                                                                                   | Client           |
| 6   | **Backups** (B7): confirm Neon plan and retention, run a restore drill                                                                                                                                                                                  | Do before any real student data                                                                                                                                                            | Operator         |
| 7   | **Merge and deploy** the readiness fix and probe                                                                                                                                                                                                        | Approve. Low risk, no migration or configuration change                                                                                                                                    | Release manager  |

Other risks:

- Failed notification emails are not retried on Vercel, and no sweep or cron runs (PRODUCTION-DEPLOYMENT §5).
- The API has no crash handlers on Vercel: those in `server.ts` do not run.
- `DATABASE_URL` uses an SSL mode whose meaning changes in the next major `pg` version, per the warning on every new instance. Set `sslmode=verify-full` explicitly, which keeps today's behaviour. Needs an authorised environment change.
- Students and staff would wait 4–10 s on the first request after idle.
- Sign-in, learning, certificates, email and payments have never been verified in production (PRODUCTION-SMOKE-TESTS N1–N6).

## 9. Recommended next priorities

1. Decisions 1–3 above.
2. Deploy the fix, retest, and turn on the probe with a named owner.
3. Clear B2–B5, then begin UAT on an isolated staging environment.
4. Create production smoke accounts (with approval) and verify N1–N6.
5. After launch, repeat this review with real traffic. It is the first point at which trends, usage findings and alert thresholds mean anything.

**Phase 18 is not complete.** Monitoring gaps are documented, but alerts have no owner, no stabilization period has been observed, and the patch has not been approved or deployed.

## 10. Git

No Git write operation was performed: no staging, commit, push, pull, branch change or reset. All changes are uncommitted in the working tree.
