# ASRA Academy — QA Defect Log (PHASE 15)

Version 0.1.0 · 2026-10-28 · Strategy: [QA-STRATEGY.md](./QA-STRATEGY.md) · Report: [QA-REPORT.md](./QA-REPORT.md)

Environment for every entry unless stated: local macOS (Apple Silicon), Node 22.23.3, PostgreSQL 17 + Redis 7.4 (Docker), QA stack = `node apps/api/dist/server.js` on :4100 + `next start` on :3100 against `asra_academy_qa`, Chrome 156 headless. Secrets removed from all evidence.

**Status values:** Open · Fixed (code changed, not yet re-verified) · Retested (fixed and verified) · Blocked · Accepted (documented decision).

## Summary

| Severity | Found | Retested (fixed) | Partly fixed | Open | Accepted |
| -------- | ----- | ---------------- | ------------ | ---- | -------- |
| P0       | 0     | 0                | 0            | 0    | 0        |
| P1       | 1     | 1                | 0            | 0    | 0        |
| P2       | 1     | 1                | 0            | 0    | 0        |
| P3       | 8     | 2                | 1 (DEF-10)   | 5    | 0        |

QA-DEF-03 is fixed but changes a documented security control; it needs reviewer sign-off (see the entry).

---

### QA-DEF-03 — P1 — Signed-in users behind a shared IP are logged out by the refresh rate limit

- **Module:** Authentication / sessions (`apps/api/src/config/constants.ts`, `middleware/rate-limit.ts`; web `components/auth/auth-provider.tsx`)
- **Route:** `POST /api/v1/auth/refresh`
- **Steps:** (1) From one IP, make 60 refresh calls in 15 minutes — e.g. 30 students in a school lab each opening the portal (every full page load calls refresh, the portal shell calls it twice when signed out). (2) Any further signed-in user on that IP loads a page.
- **Expected:** valid sessions are refreshed; abuse (token guessing) is limited.
- **Actual:** 429 `RATE_LIMITED`. The web client treats every non-network error from refresh as an invalid session (`clearSession`) and sends the user to `/login`; after logging in, the next page load is refused again — for up to 15 minutes, for **everyone** on that IP. The limiter counted successful refreshes and requests without any refresh cookie.
- **Evidence:** browser run 1 — 80 refresh calls, 22 answered 429, every admin portal page redirected to `/login?next=…`. Regression test on the unfixed code: `anonymous refresh #61` → 429.
- **Why P1:** staying signed in is a core journey; the platform's users (students on school networks, Indian mobile carriers' CGNAT) are exactly the shared-IP case. The codebase already keys assessment limits per user "so students behind one school NAT do not share a quota".
- **Fix:** refresh now counts only **failed** attempts that **present** a refresh cookie (the token-guessing signal). Successful refreshes and cookie-less requests (cheap 401, no lookup) are not counted. Limit (60/15 min/IP) unchanged.
- **Regression:** `apps/api/tests/security.test.ts` → "refresh never throttles valid sessions or cookie-less visitors behind one IP", "refresh still limits invalid refresh tokens per IP".
- **Retest:** browser run 2 — 52 refresh calls, 0 × 429, all portal pages rendered for student/faculty/admin.
- **Status:** **Retested.** ⚠ Changes the semantics of a documented security control (AUTHENTICATION.md §6, SECURITY.md §2) — **requires review/sign-off** before merge. Residual: valid-session refreshes are no longer rate limited per IP; each still rotates the token and runs reuse detection.

### QA-DEF-02 — P2 — robots.txt blocks the public `/faculty` page that the sitemap submits

- **Module:** SEO (`apps/web/src/app/robots.ts`)
- **Steps:** build with `SITE_INDEXING_ENABLED=true`; read `/robots.txt` and `/sitemap.xml`.
- **Expected:** every sitemap URL is crawlable; portals are not.
- **Actual:** `Disallow: /faculty` (prefix match) also blocks `/faculty` — the public "Our faculty" page linked from the main navigation and listed in the sitemap. Search engines would not crawl it and Search Console reports "Submitted URL blocked by robots.txt".
- **Fix:** disallow `/faculty/` (portal paths); portal layouts already send `noindex`.
- **Regression:** `apps/web/tests/public-website.test.tsx` → "never disallows a page the sitemap submits, but still covers every portal".
- **Status:** **Retested** (web suite green).

### QA-DEF-01 — P3 — Certificate PDFs could be kept in the browser cache

- **Module:** Certificates (`apps/api/src/modules/certificates/certificates.controller.ts`)
- **Route:** `GET /student/certificates/:id/download`, `GET /admin/certificates/:id/download`
- **Expected:** personal documents are `no-store` (SECURITY.md §6: "Everything else is `no-store`").
- **Actual:** `Cache-Control: private, max-age=0, must-revalidate` — no shared caching, but a browser may write the PDF (student's — often a minor's — name) to disk on a shared computer.
- **Fix:** `Cache-Control: no-store` on both downloads.
- **Regression:** `apps/api/tests/certificates.test.ts` → "downloads publication-grade PDF…" now asserts the header for the student **and** the (previously untested) admin download.
- **Status:** **Retested** (E2E: `200 application/pdf … cache=no-store`).

### QA-DEF-04 — P3 — Certificate search field has no accessible name

- **Module:** Public website / accessibility (`apps/web/src/components/public/certificate-verification.tsx`)
- **Route:** `/verify`, `/verify/:id`
- **Actual:** the input had only a placeholder; screen readers announced an unnamed text field (WCAG 1.3.1, 4.1.2).
- **Fix:** `aria-label="Certificate ID"`.
- **Regression:** `apps/web/tests/hardening-phase14.test.tsx` → "gives the certificate search field an accessible name".
- **Status:** **Retested** (web suite green). Not re-checked in a browser after the fix (the QA web build predates it).

### QA-DEF-05 — P3 — Any API error during refresh signs the user out of the UI

- **Module:** Web auth (`apps/web/src/components/auth/auth-provider.tsx:63-66`)
- **Actual:** only `NETWORK_ERROR` keeps the session; a 429 or 5xx from `/auth/refresh` clears it and redirects to `/login`. The server-side session stays valid (a reload recovers).
- **Recommendation:** clear the session only on 401; treat 429/5xx like a network error (retry later). Not changed in this phase (client behaviour change; QA-DEF-03 removes the main trigger).
- **Status:** Open.

### QA-DEF-06 — P3 — Admin opening `/admin/audit-logs` directly sees a retryable error

- **Module:** Admin portal. Admin (not Super Admin) → `/admin/audit-logs` by URL (the nav item is hidden).
- **Actual:** "Could not load this data — You do not have permission…" with **Try again**, and an empty Log selector. Data is correctly refused by the API (403).
- **Expected:** a no-access state like `/admin` shows to students ("No access to administration").
- **Status:** Open.

### QA-DEF-07 — P3 — "1 active accounts" on the admin dashboard

- **Module:** Admin dashboard KPI cards (Faculty card with one account). Pluralisation only.
- **Status:** Open.

### QA-DEF-08 — P3 — Lighthouse accessibility findings on the home page (score 96)

- Decorative step numbers (`aria-hidden`, gold-200 `#f5dca6` on `#fffefb`, 1.32:1) flagged by axe colour-contrast. WCAG 1.4.3 exempts purely decorative text, so this is a design-system decision.
- Brand link `aria-label="ASRA Academy"` while visible text also includes the tagline (axe `label-content-name-mismatch`, WCAG 2.5.3).
- **Status:** Open — design decision (DESIGN-SYSTEM.md tokens not changed in QA).

### QA-DEF-09 — P3 — `pg` deprecation warning inside Prisma interactive transactions

- **Evidence:** 14 occurrences in the baseline test run: `DeprecationWarning: Calling client.query() when the client is already executing a query … will be removed in pg@9.0`, stack inside `@prisma/adapter-pg` `PgTransaction.performIO` (no application frame).
- **Impact:** none today; a future `pg@9` would turn it into errors.
- **Recommendation:** do not upgrade `pg` to 9 independently; take it with the Prisma 7.10.1+ upgrade already recommended in SECURITY.md §5, with a full regression run.
- **Status:** Open (dependency).

### QA-DEF-10 — P3 — Documentation drift

- `CHANGELOG.md` (Phase 13) said `certificates.view` is granted to Student and Faculty; the seed grants it to Admin and Super Admin only (verified, and the route-guard suite proves students/faculty get 403). **Fixed** in the changelog.
- `ADMIN-DASHBOARD.md` §module table still lists Certificates as "Missing (Phase 13)"; `COURSE-MANAGEMENT.md` still describes QUIZ/ASSIGNMENT lessons as placeholders (built in Phase 09). **Open** (historical phase documents; update when next edited).

## Observations (not defects)

- A second certificate claim returns `201` with the same certificate (idempotent; `200` would be more conventional).
- `GET /health` reports the environment name; harmless, but can be dropped if the client prefers minimal disclosure.
- Previously recorded items carried forward unchanged: SEC-10 (Prisma CLI audit findings, accepted), SEC-11 (CSP `unsafe-inline`, accepted ADR-031), SEC-12 (webhook event-id not signed, accepted), SEC-13/SEC-14 (open — AH-02/AH-03).
