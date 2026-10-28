# ASRA Academy — QA Report & Release Readiness (PHASE 15)

Version 0.1.0 · 2026-10-28 · Branch `main` @ `6ecadd0` + uncommitted Phase 15 changes · Strategy: [QA-STRATEGY.md](./QA-STRATEGY.md) · Matrix: [QA-TEST-MATRIX.md](./QA-TEST-MATRIX.md) · Defects: [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md)

## Release recommendation: **CONDITIONALLY READY**

Ready to proceed to **UAT on a staging environment (Phase 16)**. **Not ready for a production launch with paid enrolment** until the conditions below are met.

- No P0 defect was found. The single P1 (QA-DEF-03, users logged out behind shared IPs) and the single P2 (QA-DEF-02, robots.txt) are **fixed with regression tests**.
- QA-DEF-03 changes a documented security control and **requires technical sign-off** (CLIENT-CLARIFICATIONS AI-01) before merge. It is not treated as accepted by this report.

Conditions for production release:

1. AI-01 — sign-off and merge of the QA-DEF-03 fix.
2. AI-02 — Razorpay **test-mode** checkout, webhooks and refund verified end to end on staging. The payment integration has only ever run against a simulated gateway.
3. AI-04 — Resend email delivery and (if live classes use it) Google Meet verified on staging.
4. AI-03 — supported-browser policy agreed; Safari (iOS) and Firefox checked in UAT.
5. AI-05 — stakeholder acceptance of the open P3 items, or their remediation.
6. The deployment requirements in SECURITY.md §6 (shared Redis, proxy hops, `CORS_ORIGINS`, `SITE_INDEXING_ENABLED`) are applied on the production project.

## 1. Scope and environment

- **Scope:** every module built in Phases 01–14 (auth, academics, courses, curriculum, student LMS, faculty portal, assessments, enrolment/payments, live classes, notifications, admin dashboard, certificates, SEO/security). Section 7 of the Development Order (commercial proposal) excluded as instructed.
- **Machine:** macOS (Apple Silicon), Node 22.23.3, npm workspaces; PostgreSQL 17 and Redis 7.4 in Docker.
- **Databases:** `asra_academy_test` (automated tests, guarded to local `*_test`), `asra_academy_qa` (created for Phase 15: migrations + seed). The developer database and Neon were not touched.
- **QA stack:** production builds — `node apps/api/dist/server.js` (:4100) and `next start` (:3100) — with console email, memory rate-limit store, no Razorpay/Meet credentials.
- **Not available:** staging/production deployment, Razorpay test keys, Resend/Google credentials, Firefox, Safari automation, physical devices.

## 2. Modules and journeys tested

All modules in the matrix. End-to-end journeys run on the built stack:

- Admin builds the academic structure and a course, assigns faculty, publishes. Faculty publishing through the admin API is refused.
- The public catalogue shows only published courses; search, pagination, input bounds and SQL-injection strings are handled.
- A student registers, is refused login until email verification, verifies, enrols free, opens and completes lessons (100% progress), claims a certificate (idempotent), downloads the PDF and is publicly verified. An admin revokes it, the public page shows "revoked" and the audit log records it.
- Another student cannot download that certificate or open lessons. Notifications are owner-only.
- Session lifecycle: rotation, replay detection revoking the session, suspension taking effect immediately, no self-status change, no escalation to Super Admin.
- Password reset, with no account enumeration.
- Brute-force limit, body-size limit, mass-assignment refusal, and payments' honest "unavailable" state.
- In the browser: real login form for student, faculty and admin; portal rendering; cross-role `/admin` refusal; unauthenticated redirects.

## 3. Test counts (actual runner output)

| Suite                                                              | Command                 | Tests         | Pass    | Fail | Skipped | Notes                                                                                                           |
| ------------------------------------------------------------------ | ----------------------- | ------------- | ------- | ---- | ------- | --------------------------------------------------------------------------------------------------------------- |
| API baseline (before Phase 15)                                     | `npm test`              | 418           | 418     | 0    | 0       | 112 suites, 117 s                                                                                               |
| **API final**                                                      | `npm test`              | **431**       | **431** | 0    | 0       | 117 suites; +13 new (8 route guards, 3 IDOR, 2 refresh limit) + 1 strengthened assertion                        |
| – of which **unit** (no DB/HTTP)                                   | 6 files                 | 68            | 68      | 0    | 0       | scoring, pricing/signatures, progress, env, email, Meet adapter                                                 |
| – of which **integration** (real Express + PostgreSQL + Redis)     | 28 files                | 363           | 363     | 0    | 0       | external providers faked (Razorpay, Meet) — see QA-STRATEGY §3                                                  |
| Web baseline                                                       | `npm test -w @asra/web` | 190           | 190     | 0    | 0       |                                                                                                                 |
| **Web final** (component/unit)                                     | `npm test -w @asra/web` | **192**       | **192** | 0    | 0       | +2 new                                                                                                          |
| **E2E — API journey** on built stack (scripted, not in `npm test`) | Phase 15 script         | 66            | 66      | 0    | 0       | Final run after fixes. Earlier runs' failures were script errors (field names, step order), not product defects |
| **E2E — browser** (headless Chrome 156, scripted)                  | Phase 15 script         | 84 page loads | see §6  | —    | —       | 17 public routes × 3 viewports, 5 unauthenticated redirects, 28 signed-in page loads                            |
| Committed browser E2E framework                                    | —                       | —             | —       | —    | —       | **None exists** in the repository                                                                               |

## 4. Build and static gates

| Gate             | Command                                                          | Outcome                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Format           | `npm run format:check`                                           | Pass (initial run flagged only the new Phase 15 test file; formatted)                                                                         |
| Lint             | `npm run lint`                                                   | Pass (`--max-warnings=0`)                                                                                                                     |
| Prisma schema    | `npm run db:validate`                                            | Pass                                                                                                                                          |
| Migrations       | `db:migrate:status`; `migrate deploy` on fresh `asra_academy_qa` | 10 migrations, up to date; all applied cleanly to an empty database                                                                           |
| Typecheck        | `npm run typecheck`                                              | Pass                                                                                                                                          |
| Production build | `npm run build`                                                  | Pass (API `tsc`, Next.js 16.4.2)                                                                                                              |
| Dependency audit | `npm audit --omit=dev`                                           | 5 findings (4 high, 1 moderate), all in the **Prisma CLI** (`mysql2`, `deepmerge-ts`, `fast-uri`) — unchanged since Phase 14, accepted SEC-10 |

## 5. Security findings

| ID        | Severity | Finding                                                                                                           | Status                                  |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| QA-DEF-03 | P1       | Refresh rate limit (per IP, counting successes) logged out everyone behind a shared IP after 60 page loads/15 min | Retested; **sign-off required** (AI-01) |
| QA-DEF-01 | P3       | Certificate PDFs `private` instead of `no-store`                                                                  | Retested                                |
| QA-DEF-05 | P3       | Web signs the user out on any non-network refresh error (429/5xx)                                                 | Open                                    |

Verified without findings:

- Every one of the 222 protected route×method pairs refuses anonymous callers (401) and wrong roles (403). The Super-Admin-only set is exact.
- No IDOR on attempts, orders, receipts, certificates or notifications.
- Forged JWTs are rejected.
- CSRF origin check, refresh-token replay detection and immediate suspension all work.
- Server-side pricing; webhook signatures (integration tests).
- No mass assignment, and a 413 on oversized bodies.
- Injection strings are treated as data, and the XSS payload is stored as text.
- `no-store` on protected responses; headers as documented in SECURITY.md §4.

There is no upload endpoint to attack (R-01). No penetration test, DAST or load test was performed.

## 6. Browser and viewport coverage

| Browser                              | Viewports                   | Pages                                                                                                                                                                                           | Method                                           | Outcome                                                                                                                                                                    |
| ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome 156 (headless)                | 375×812, 768×1024, 1440×900 | 17 public routes (home, courses, course detail, class band, about, faculty, admission, contact, verify, verify/:id, 3 legal, login, register, forgot, 404)                                      | Automated (CDP)                                  | No horizontal overflow, no broken images, no JS exceptions. Only console entries: the expected 401 from the silent session check on auth pages, and the 404 page's own 404 |
| Chrome 156 (headless)                | 375×812, 1440×900           | Student: dashboard, courses, player, certificates, payments, `/admin` (refused). Faculty: dashboard, course, `/admin` (refused). Admin: dashboard, courses, certificates, analytics, audit logs | Automated, signed in through the real login form | All rendered for the right role. Unauthenticated portal URLs redirect to `/login?next=…` with `noindex`. Admin → audit logs shows a retryable error (QA-DEF-06)            |
| Chrome 156                           | 1440×900                    | Home                                                                                                                                                                                            | Automated keyboard test                          | Skip link is the first stop; focus visible on all 6 checked stops                                                                                                          |
| —                                    | —                           | Screenshots of home, course detail, verify (revoked), player, portals                                                                                                                           | **Manual visual review**                         | Layout, brand and states correct. "1 active accounts" (QA-DEF-07)                                                                                                          |
| Firefox, Safari/WebKit, real devices | —                           | —                                                                                                                                                                                               | —                                                | **Not tested** (not available) — AI-03                                                                                                                                     |

## 7. Performance (lab only)

Lighthouse 12.6.1, mobile preset (simulated 4× CPU / slow 4G), **single run per page** on the local QA build. No CDN, HTTP/1.1, same machine as the servers.

| Page          | Perf | LCP   | CLS | TBT   | FCP   | Transfer | A11y | Best practices |
| ------------- | ---- | ----- | --- | ----- | ----- | -------- | ---- | -------------- |
| Home          | 91   | 3.5 s | 0   | 80 ms | 0.9 s | 412 KB   | 96   | 100            |
| Course list   | 90   | 3.6 s | 0   | 0 ms  | 0.9 s | 400 KB   | 100  | 100            |
| Course detail | 95   | 3.0 s | 0   | 10 ms | 0.9 s | 386 KB   | 100  | 100            |
| Verify        | 94   | 3.1 s | 0   | 0 ms  | 0.9 s | 435 KB   | 100  | 100            |

SEO scores 69 **by design**: indexing is disabled outside production. Results are consistent with Phase 14 ([PERFORMANCE.md](./PERFORMANCE.md)), whose 3-run medians and API latencies (all endpoints ≤ 15 ms p95 locally) remain the reference. Phase 15 did not repeat the latency or large-dataset measurements.

**Limitations:**

- Lab LCP above 2.5 s is dominated by the simulated throttling of framework JavaScript (PERFORMANCE.md §6).
- No field data (INP), CDN, Neon network latency or cold starts were measured.
- Single runs vary by ±0.3–0.9 s.
- These numbers are not evidence of production performance.

## 8. Defects and remediation

| ID        | Sev | Module       | Summary                                                       | Status                    | Regression test              |
| --------- | --- | ------------ | ------------------------------------------------------------- | ------------------------- | ---------------------------- |
| QA-DEF-03 | P1  | Auth         | Shared-IP users logged out by refresh limit                   | Retested · sign-off AI-01 | `security.test.ts` (2)       |
| QA-DEF-02 | P2  | SEO          | robots.txt blocked public `/faculty` listed in sitemap        | Retested                  | `public-website.test.tsx`    |
| QA-DEF-01 | P3  | Certificates | PDF downloads cacheable by browser                            | Retested                  | `certificates.test.ts`       |
| QA-DEF-04 | P3  | A11y         | Certificate search field unlabelled                           | Retested (unit)           | `hardening-phase14.test.tsx` |
| QA-DEF-05 | P3  | Web auth     | Any refresh error signs user out                              | Open                      | —                            |
| QA-DEF-06 | P3  | Admin UI     | Retryable error instead of no-access state                    | Open                      | —                            |
| QA-DEF-07 | P3  | Admin UI     | "1 active accounts"                                           | Open                      | —                            |
| QA-DEF-08 | P3  | A11y         | Decorative contrast; brand link label-in-name                 | Open (design, AI-06)      | —                            |
| QA-DEF-09 | P3  | Dependencies | `pg` deprecation inside Prisma transactions                   | Open                      | —                            |
| QA-DEF-10 | P3  | Docs         | Changelog permission line (fixed); stale module tables (open) | Partly fixed              | —                            |

Totals: **10 found** — 0 P0, 1 P1, 1 P2, 8 P3. **4 fixed and retested**, 1 partly fixed, 5 open (all P3).

## 9. Known unimplemented features and external blockers

**Not implemented** (documented earlier, confirmed in QA):

- File uploads / storage provider (R-01). Lesson media are HTTPS links.
- Coupons (AF-08), announcements (AF-09), enquiries backend (AF-10), blog/CMS (AF-11; `/blog` is empty and excluded from the sitemap).
- Staff invitations: staff accounts are created with `npm run auth:create-user` (S-05).
- Parent/guardian accounts (E-03) and admin sub-roles (S-01).
- WhatsApp/SMS/push and reminders.
- Email provider webhooks.
- Automatic meeting recordings.
- Approved certificate signature images: placeholder signatory titles are used (AG-03).

**Blocked by external services or credentials:**

- Razorpay test/live checkout (AH-06/AI-02).
- Resend delivery and Google Meet API (AI-04).
- Staging environment (W-06).
- Production Redis/CDN topology (AH-05).

**Awaiting client decisions:** the pending items in CLIENT-CLARIFICATIONS (A–AH), plus new §AI. In particular AH-01 (minors' names on public certificate pages), AH-02 (revocation reason shown publicly) and AH-03 (certificates for unpublished courses).
