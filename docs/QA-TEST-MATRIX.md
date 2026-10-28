# ASRA Academy — QA Test Matrix (PHASE 15)

Version 0.1.0 · 2026-10-28 · Strategy: [QA-STRATEGY.md](./QA-STRATEGY.md) · Defects: [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md)

**Evidence keys** — **U** unit test · **I** API integration test (real DB/Redis) · **C** web component test · **E** API E2E journey on the running built stack (66 checks) · **B** automated headless-Chrome run · **V** manual visual review of screenshots · **R** code review only.
**Result** — Pass · Fail→Fixed (defect id) · Blocked (reason) · N/I (not implemented — no test can pass it) · Client (needs a client decision).

## 1. Authentication and accounts

| Check                                                                                | Evidence                  | Result                        |
| ------------------------------------------------------------------------------------ | ------------------------- | ----------------------------- |
| Register (202, anti-enumeration), weak password 422                                  | I `auth`, E               | Pass                          |
| Login refused before email verification (403 `EMAIL_NOT_VERIFIED`)                   | I, E                      | Pass                          |
| Email verification via emailed one-time link                                         | I, E (console transport)  | Pass                          |
| Invalid credentials and unknown email → identical generic 401                        | I, E                      | Pass                          |
| Logout, logout-all, refresh rotation, replayed refresh → session revoked             | I, E                      | Pass                          |
| Refresh for many users behind one IP                                                 | B, I `security`           | Fail→Fixed **QA-DEF-03 (P1)** |
| Password reset: same response for unknown email, old password rejected, new accepted | I, E                      | Pass                          |
| Suspended account: existing access token rejected immediately                        | I, E                      | Pass                          |
| CSRF: auth routes refuse untrusted `Origin`                                          | I `security`, E           | Pass                          |
| Login brute force → 429 after 10 failures                                            | I, E                      | Pass                          |
| Role-based landing & portal redirects (`/login?next=…`)                              | C, B (5 protected routes) | Pass                          |
| Student/faculty opening `/admin` → "No access to administration"                     | B                         | Pass                          |
| Real email delivery (Resend)                                                         | —                         | Blocked (no credentials)      |

## 2. Courses and academic management

| Check                                                                                                        | Evidence              | Result              |
| ------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------- |
| Academic levels, classes, subjects, categories CRUD                                                          | I `academics`, E      | Pass                |
| Course draft → publish rules; faculty cannot publish via admin API                                           | I `courses`, E        | Pass                |
| Draft hidden from public; published listed; search `q`, pagination, `pageSize` bound, unknown query keys 422 | I `public-catalog`, E | Pass                |
| SQL-injection string in search treated as data                                                               | E                     | Pass                |
| Curriculum (modules/chapters/lessons/resources), cross-course manipulation refused                           | I `curriculum`        | Pass                |
| Faculty assignment; faculty sees only assigned courses                                                       | I `faculty-portal`, E | Pass                |
| Course detail / listing rendering at 3 viewports                                                             | B, V                  | Pass                |
| Streams for Classes 11–12, final subject lists                                                               | —                     | Client (A-01, A-02) |

## 3. Enrolment and payments

| Check                                                                                                  | Evidence                        | Result                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------- |
| Free self-enrolment; duplicate enrolment safe                                                          | I `student-lms`, E              | Pass                                    |
| Server-side price, client amount ignored, strict body                                                  | U `payments-unit`, I `payments` | Pass                                    |
| Checkout signature, success / failure / cancel / pending states                                        | I (fake gateway)                | Pass                                    |
| Webhook signature over raw body, forged/mismatched refused, duplicate & out-of-order events idempotent | I                               | Pass                                    |
| Refunds (full/partial, idempotent), access revocation                                                  | I                               | Pass                                    |
| Orders/receipts not visible to other students                                                          | I `qa-idor-phase15`             | Pass                                    |
| Payments unavailable state when keys absent; unsigned webhook refused                                  | E (503)                         | Pass                                    |
| Razorpay Checkout in a browser / real test-mode provider                                               | —                               | **Blocked** (no test keys — AH-06/W-06) |

## 4. Learning and assessments

| Check                                                                                      | Evidence                                  | Result |
| ------------------------------------------------------------------------------------------ | ----------------------------------------- | ------ |
| Enrolled-only lesson access; non-enrolled student refused                                  | I, E                                      | Pass   |
| Lesson complete/reopen, progress persistence, 100% completion                              | U `progress-rules`, I, E                  | Pass   |
| Course player renders (mobile/desktop) with completion state                               | B, V                                      | Pass   |
| Assignments: late/resubmission rules, grading, result release                              | I `assignments-phase09`, `faculty-portal` | Pass   |
| Quizzes: attempt limits, timing, negative marking, shuffling, reveal                       | U `assessment-scoring`, I `quizzes`       | Pass   |
| Exams: server deadline, autosave, expiry sweep, manual grading, publication (21 scenarios) | I `examinations`                          | Pass   |
| Attempts unreadable/unanswerable by other students; unassigned faculty refused             | I `qa-idor-phase15`                       | Pass   |

## 5. Certificates

| Check                                                                                  | Evidence   | Result                                        |
| -------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- |
| Ineligible before completion; early claim refused                                      | I, E       | Pass                                          |
| Issue once; duplicate/concurrent claims return the same certificate                    | I, E       | Pass                                          |
| PDF generated (`%PDF-`, ~160 KB), owner-only download                                  | I, E       | Pass                                          |
| PDF never cached                                                                       | I, E       | Fail→Fixed **QA-DEF-01**                      |
| Public verification valid / unknown 404 / malformed rejected; no email or UUID exposed | I, E, B    | Pass                                          |
| Revocation needs reason; public page shows revoked; audit entry                        | I, E, B, V | Pass                                          |
| Verify search field accessible name                                                    | B, C       | Fail→Fixed **QA-DEF-04**                      |
| Signatures                                                                             | R          | Placeholder titles, no image (AG-03 — Client) |

## 6. Notifications and live classes

| Check                                                                                                              | Evidence                 | Result                                                |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------ | ----------------------------------------------------- |
| In-app inbox per user; cannot mark another user's notification                                                     | I `notifications`, E     | Pass                                                  |
| Outbox idempotency, retries, permanent failure                                                                     | I                        | Pass                                                  |
| Live classes: schedule/reschedule/cancel, host must be assigned, enrolled-only links, manual YouTube recording URL | I `live-classes-phase11` | Pass                                                  |
| Google Meet adapter                                                                                                | U (fake client)          | Pass (mocked) · real API **Blocked** (no credentials) |
| WhatsApp, SMS, push, reminders                                                                                     | —                        | N/I (out of scope / deferred)                         |

## 7. Admin and faculty portals

| Check                                                                             | Evidence                                 | Result                        |
| --------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| Dashboard KPIs equal database counts (students 9/7, courses 5/5, enrolments 3/3)  | E + SQL cross-check                      | Pass                          |
| Analytics ranges, IST boundaries, revenue net of refunds                          | I `admin-dashboard-phase12`              | Pass                          |
| No self status change; Admin cannot grant SUPER_ADMIN; last Super Admin protected | I, E                                     | Pass                          |
| Exact Super-Admin-only route set (roles, audit logs, refunds)                     | I `qa-route-guards-phase15`              | Pass                          |
| Audit log written for revocation, status, publication                             | I, E                                     | Pass                          |
| Admin direct URL to audit logs shows a no-access state                            | B, V                                     | Minor UX **QA-DEF-06** (Open) |
| Faculty limited to assigned courses/students                                      | I `faculty-portal`, `qa-idor-phase15`, E | Pass                          |
| Coupons, announcements, enquiries backend, blog/CMS, staff invitations            | —                                        | N/I (AF-08–AF-11, S-05)       |

## 8. SEO and security

| Check                                                                               | Evidence                                         | Result                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Every protected route: 401 unauthenticated, 403 wrong role (222 route×method pairs) | I `qa-route-guards-phase15`                      | Pass                                          |
| Canonical URLs, JSON-LD, `noindex` on private/auth/certificate pages                | C, B (17 public routes × 3 viewports)            | Pass                                          |
| robots.txt vs sitemap consistency                                                   | C                                                | Fail→Fixed **QA-DEF-02 (P2)**                 |
| Security headers (CSP, frame, nosniff, HSTS on HTTPS prod)                          | C, I, curl                                       | Pass                                          |
| Default `no-store`; public catalogue `s-maxage=60`                                  | I `hardening-phase14`, `qa-route-guards-phase15` | Pass                                          |
| 2 MB JSON body → 413; unknown fields refused (strict schemas)                       | E                                                | Pass                                          |
| XSS payload in a name stored as text, escaped on render                             | E, C                                             | Pass                                          |
| File uploads                                                                        | R (no upload endpoint exists — R-01)             | N/I                                           |
| Dependency audit                                                                    | `npm audit`                                      | 5 findings, Prisma CLI only (accepted SEC-10) |

## 9. UI / cross-browser

| Browser / viewport                                                   | Evidence | Result                                                              |
| -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| Chrome 156 (headless) — 375×812, 768×1024, 1440×900                  | B, V     | Pass: no overflow, no broken images, no exceptions on 84 page loads |
| Keyboard: skip link first, visible focus on first 6 tab stops (home) | B        | Pass                                                                |
| Firefox                                                              | —        | **Blocked** (not installed)                                         |
| Safari / WebKit                                                      | —        | **Blocked** (needs "Allow Remote Automation"; not run)              |
| Physical mobile devices                                              | —        | Not run (emulated viewports only)                                   |
