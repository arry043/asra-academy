# ASRA Academy — QA Strategy (PHASE 15)

Version 0.1.0 · Phase 15 (Complete QA) · 2026-10-28 · Related: [QA-TEST-MATRIX.md](./QA-TEST-MATRIX.md), [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md), [QA-REPORT.md](./QA-REPORT.md)

This is how the system is verified before UAT (Phase 16). It describes what each test layer proves, where it runs and what it deliberately does **not** prove.

## 1. Test pyramid

| Layer                     | Tooling (existing)                                                                                   | What it proves                                                                                             | Location                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Unit                      | `node:test` + `tsx`                                                                                  | Pure rules: scoring, pricing, signatures, progress, env validation, email templates, Meet adapter          | `apps/api/tests/{assessment-scoring,payments-unit,progress-rules,env,email,google-meet-provider}.*` |
| Integration (API)         | `node:test`, real Express app on an ephemeral port, real PostgreSQL (`*_test` DB), real Redis        | HTTP contracts, RBAC, ownership, transactions, idempotency, webhooks (fake gateway), rate limits           | every other `apps/api/tests/*.test.ts`                                                              |
| Component (web)           | `node:test` + `react-dom/server`                                                                     | Rendering, helpers, SEO metadata, robots/sitemap, security headers, redirects                              | `apps/web/tests/*`                                                                                  |
| E2E — API journey         | Scripted HTTP client against the **running built** API (`node dist/server.js`) on a throw-away QA DB | Complete journeys across modules on the shipped artefacts (no test hooks)                                  | Phase 15 run; script described in QA-REPORT §3                                                      |
| E2E — browser (automated) | Headless Chrome via the DevTools Protocol against `next start` + built API                           | Real login form, redirects, rendering at 3 viewports, console errors, overflow, broken images, focus order | Phase 15 run; QA-REPORT §6                                                                          |
| Manual visual review      | Screenshots from the automated browser run, reviewed by eye                                          | Layout, brand consistency, legibility                                                                      | QA-REPORT §6                                                                                        |
| Performance (lab)         | Lighthouse 12.6.1 mobile preset                                                                      | LCP/CLS/TBT, bytes, console errors — lab only                                                              | QA-REPORT §7, [PERFORMANCE.md](./PERFORMANCE.md)                                                    |

The repository has **no committed browser E2E framework** (no Playwright/Cypress). Phase 15 did not add one (no new dependencies); the browser and API journeys above were executed as scripted QA runs and are reported as such, not as part of `npm test`.

## 2. Environments and data isolation

| Environment           | Database                                                                                                     | Purpose                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Automated tests       | `asra_academy_test` (local Docker). The resolver **refuses** non-local hosts and names not ending in `_test` | `npm test`                        |
| Phase 15 QA stack     | `asra_academy_qa` (local Docker, created for this phase, `prisma migrate deploy` + `prisma db seed`)         | E2E journeys, browser, Lighthouse |
| Developer environment | `asra_academy` (local) — **not touched** by QA                                                               | `npm run dev`                     |

- Production (Neon) and any staging environment were not accessed. No production secrets were used.
- The QA stack ran on ports 4100/3100 next to the developer's running dev servers (3000/4000), with `EMAIL_TRANSPORT=console` (nothing is sent), `RATE_LIMIT_STORE=memory` (does not touch the shared Redis counters), Razorpay and Google Meet credentials blank.
- Test accounts: `qa-super-admin@`, `qa-admin@`, `qa-faculty@`, `qa-student@example.test` (provisioned with `npm run auth:create-user`, QA-only password), plus students registered through the public flow during the journey.

## 3. External services: mocked vs real

| Service      | Automated tests                                        | Phase 15 runtime QA                                                 | Real provider verified?            |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------- |
| Razorpay     | In-memory `FakeRazorpay` gateway, real HMAC signatures | Not configured → checkout reported unavailable; webhook returns 503 | **No** (no test keys — AH-06/W-06) |
| Resend email | `memory` transport                                     | `console` transport (links read from the API log)                   | **No**                             |
| Google Meet  | Injected fake client                                   | Not configured                                                      | **No**                             |
| Redis        | Real local Redis (`rate-limit-store`, `http` tests)    | Not used (memory store)                                             | Local only                         |

## 4. Entry and exit criteria

- **Entry:** clean `main` checkout + Phase 14 working tree; migrations apply; all gates runnable.
- **Exit (this phase):** every gate executed with recorded outcome; every defect classified P0–P3 with status; P0 none open; P1 fixed or carrying an explicit stakeholder decision; release recommendation stated.

## 5. Severity scale

P0 critical (unusable, major compromise, data corruption) · P1 high (core journey broken, serious authorization failure) · P2 medium (important issue, workaround exists) · P3 minor (cosmetic/low impact). Security issues are not downgraded for being hard to reproduce.

## 6. Regression policy

Every fixed defect gets an automated regression test in the existing suites (see QA-DEFECT-LOG). Phase 15 added two permanent API suites:

- `qa-route-guards-phase15.test.ts` — enumerates **every registered** admin/student/faculty/notification route (222 route×method pairs) and asserts 401 unauthenticated, 403 for the wrong role, and the exact Super-Admin-only set. A new route without a guard fails this suite automatically.
- `qa-idor-phase15.test.ts` — cross-student and cross-faculty access to attempts, orders and receipts.
