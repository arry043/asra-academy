# ASRA Academy — User Acceptance Testing Plan (PHASE 16)

Version 0.1.0 · Prepared 2026-10-28 by Marvel's Techworks · Test cases: [UAT-TEST-CASES.md](./UAT-TEST-CASES.md) · Feedback: [UAT-FEEDBACK-LOG.md](./UAT-FEEDBACK-LOG.md) · Access: [UAT-ACCESS-SETUP.md](./UAT-ACCESS-SETUP.md) · Sign-off: [CLIENT-ACCEPTANCE.md](./CLIENT-ACCEPTANCE.md)

> **Status: NOT STARTED — environment prerequisites open (§5).** No client testing has taken place. Nothing in this document records a client decision.

## 1. Purpose

User Acceptance Testing (UAT) lets ASRA Academy check, in their own words and on their own schedule, that the platform does what the academy needs before it is used with real students. It ends with a recorded decision by the academy's authorised approver: **accept**, **accept with conditions**, or **reject**.

UAT does **not** replace engineering QA. Developer verification is recorded in [QA-REPORT.md](./QA-REPORT.md) (Phase 15). UAT is the academy's own check of the same system.

|                   | Developer QA (Phase 15)                     | Client UAT (Phase 16)                                                |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Who               | Marvel's Techworks                          | ASRA Academy staff (and test students/faculty chosen by the academy) |
| Where             | Local machine, simulated payment/email/Meet | Dedicated staging environment, sandbox integrations                  |
| Question answered | "Does it work as built and is it secure?"   | "Is this what the academy needs, and can we use it?"                 |
| Evidence          | Automated tests, scripts, defect log        | Test-case outcomes, feedback log, signed acceptance                  |

## 2. Baseline (from Phase 15 QA)

Source: [QA-REPORT.md](./QA-REPORT.md), [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md), [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md), [SECURITY.md](./SECURITY.md).

### 2.1 Developer QA status

- Recommendation: **Conditionally ready** — ready for UAT on staging; **not** ready for production with paid enrolment.
- API 431/431 tests, web 192/192, scripted API journey 66/66, Chrome-only browser checks. All on a **local** stack.
- Code baseline: Phase 15 changes are committed on branch `test/QA` (`4cbb9b0`) and are **not yet merged to `main`**. The UAT build must be made from an identified commit (record it in §4).

### 2.2 Features and their UAT readiness

| Area                                                                                                                                | UAT readiness                                   | Notes                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Public website (home, courses, class pages, special-course pages, about, admission, contact, legal pages, certificate verification) | **Ready**                                       | Copy is provisional until Y-01, U-01 are answered                                                       |
| Public faculty page                                                                                                                 | **Blocked — client content; shows empty state** | Teacher list is website content awaiting approved profiles (C-01, C-02); see §6                         |
| Blog                                                                                                                                | **Not implemented**                             | `/blog` is an empty page (AF-11, X-03)                                                                  |
| Contact / enquiry form                                                                                                              | **Ready with limitation**                       | Opens the visitor's email app addressed to the academy; nothing is stored in the platform (Y-05, AF-10) |
| WhatsApp button                                                                                                                     | **Blocked — client input**                      | Hidden until the number is supplied (P-02)                                                              |
| Student registration, email verification, login, password reset                                                                     | **Ready once email is configured**              | Requires Resend on staging (§5)                                                                         |
| Student learning: courses, lesson player, progress, completion                                                                      | **Ready**                                       | Lesson media are web links (no uploads, R-01)                                                           |
| Assignments (student submit, faculty grade and release)                                                                             | **Ready with limitation**                       | Text answer + optional link; no file upload (AC-09)                                                     |
| Quizzes and timed exams, results                                                                                                    | **Ready**                                       | Rules are proposed defaults (AC-01 … AC-16)                                                             |
| Certificates: claim, PDF download, public verification, revocation                                                                  | **Ready**                                       | Placeholder signatory titles (AG-03); privacy questions AH-01/AH-02 open                                |
| Notifications (in-app)                                                                                                              | **Ready**                                       |                                                                                                         |
| Notification emails                                                                                                                 | **Ready once email is configured**              |                                                                                                         |
| Live classes with manually entered meeting link                                                                                     | **Ready**                                       |                                                                                                         |
| Automatic Google Meet links                                                                                                         | **Blocked — credentials**                       | AI-04, AE-01, AE-02                                                                                     |
| Free enrolment / admin manual enrolment                                                                                             | **Ready**                                       |                                                                                                         |
| Paid enrolment, Razorpay checkout, webhooks, refunds                                                                                | **Blocked — credentials**                       | Never run against Razorpay, only a simulator (AI-02). Test-mode keys needed                             |
| Admin dashboard, analytics, academic structure, courses, enrolments, users                                                          | **Ready**                                       |                                                                                                         |
| Audit logs, roles, refunds                                                                                                          | **Super Admin only**                            | Test only if a Super Admin UAT account is approved (§3)                                                 |
| Staff invitations from the portal                                                                                                   | **Not implemented**                             | Staff accounts are created by the operator (S-05, AF-13)                                                |
| Coupons, announcements, enquiry inbox, CMS, parent accounts, WhatsApp/SMS, reminders, file uploads, automatic recordings            | **Not implemented**                             | See QA-REPORT §9                                                                                        |

### 2.3 Known defects carried into UAT

| ID        | Sev | Summary                                                                              | Status                                                     |
| --------- | --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| QA-DEF-03 | P1  | Users on a shared internet connection were signed out                                | Fixed and retested; **technical sign-off pending (AI-01)** |
| QA-DEF-05 | P3  | A temporary server error during session refresh signs the user out (reload recovers) | Open                                                       |
| QA-DEF-06 | P3  | Admin opening Audit logs by URL sees "Try again" instead of "No access"              | Open                                                       |
| QA-DEF-07 | P3  | "1 active accounts" wording on admin dashboard                                       | Open                                                       |
| QA-DEF-08 | P3  | Light-gold decorative numbers below contrast guideline; logo link label              | Open — design decision (AI-06)                             |
| QA-DEF-09 | P3  | Library deprecation warning (no user impact)                                         | Open                                                       |
| QA-DEF-10 | P3  | Documentation drift                                                                  | Partly fixed                                               |

Testers who meet these should note the ID in the feedback log rather than raise a new item.

### 2.4 Security and performance limitations

- No penetration test, DAST or load test was performed.
- Performance figures are local lab measurements only; staging and production may differ (CDN, database latency, cold starts).
- Only Chrome was tested. Firefox, Safari (iPhone/Mac) and real devices are **untested** (AI-03), so UAT is the first check on them.
- Razorpay Checkout and YouTube/Vimeo embeds have not run under the site's security policy in a real browser (SECURITY.md §7).

### 2.5 Client clarifications that affect acceptance

Most items in CLIENT-CLARIFICATIONS are still `PENDING CLIENT CONFIRMATION`; the platform runs on documented default assumptions. Accepting UAT **does not** confirm those assumptions unless the approver says so explicitly. The items most likely to affect acceptance:

- **Environment and access:** W-01 (hosting), W-06 / AI-02 (staging with Razorpay test keys), AI-04 / Q-02 (email sender domain, Meet credentials), X-05 (single point of contact / approver), AI-03 (browsers).
- **Minors and privacy:** E-01 … E-05 (guardian consent), AH-01 (full names on public certificate pages), AH-02 (revocation reason shown publicly), U-01 (legal text).
- **Business rules in use:** AA-01 (free self-enrolment), AA-04 (progress rule), AB-05 / AC-08 (results are final once released), AC-01 (which attempt counts), AD-01 … AD-09 (refunds, receipts, pricing), AG-01 … AG-05 (certificate eligibility and design), AF-03 (audit-log access).
- **Phase 15 decisions:** AI-01 … AI-06.

## 3. Scope

**In scope:** the functions marked Ready or Ready-with-limitation in §2.2, for these roles:

| Role           | Purpose in UAT                   | Account                                                    |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| Public visitor | Website content and presentation | None                                                       |
| Student        | Learning journey end to end      | 2 test students (one to check isolation)                   |
| Faculty        | Teaching, grading, live classes  | 2 test faculty (one not assigned, to check isolation)      |
| Admin          | Operations and reporting         | 1 test admin                                               |
| Super Admin    | Refunds, roles, audit logs       | **Only if the academy approves** (see UAT-ACCESS-SETUP §4) |

**Out of scope:** features marked Not implemented; production deployment; load/security testing; Section 7 of the Project Development Order (commercial proposal). Requests for new features found during UAT are recorded as **Change Requests**, not defects (§8).

**Conditionally in scope** (run only once the prerequisite is met; otherwise recorded as _Blocked_): paid checkout and refunds (Razorpay test keys), automatic Meet links (Google credentials), Safari/Firefox (testers with those browsers).

## 4. Environment

| Item                      | Value                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Environment               | Dedicated staging/UAT environment, separate from production and from developer databases |
| Web URL                   | `<to be supplied by operator>`                                                           |
| API URL                   | `<to be supplied by operator>`                                                           |
| Build / commit under test | `<commit hash — to be recorded at deployment>`                                           |
| Database                  | Separate staging database (e.g. Neon branch), test data only                             |
| Payments                  | Razorpay **Test Mode** only — no real money (or disabled, if keys are not supplied)      |
| Email                     | Resend, sending only to mailboxes controlled by the academy/project team                 |
| Live classes              | Manual meeting links; automatic Meet only if credentials supplied                        |
| Search indexing           | Off (`SITE_INDEXING_ENABLED` empty)                                                      |

Setup steps: [UAT-ACCESS-SETUP.md](./UAT-ACCESS-SETUP.md).

## 5. Entry criteria (prerequisites)

UAT starts only when all mandatory items are ticked. Items not met are recorded in §11 as blockers.

| #   | Prerequisite                                                                                                                         | Owner                                   | Mandatory               | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------- | ------ |
| E1  | Staging hosting decided and provisioned (W-01, W-06)                                                                                 | Client + Marvel's Techworks             | Yes                     | Open   |
| E2  | Email sender domain verified in Resend and API key provided (Q-02, AI-04). **The API will not start in production mode without it.** | Client (DNS) + operator                 | Yes                     | Open   |
| E3  | Build commit chosen; AI-01 decision recorded (deploy with or without the QA-DEF-03 fix)                                              | Marvel's Techworks + technical approver | Yes                     | Open   |
| E4  | Migrations and seed applied to the staging database                                                                                  | Operator                                | Yes                     | Open   |
| E5  | Test accounts created and handed over securely                                                                                       | Operator                                | Yes                     | Open   |
| E6  | Sample academic structure and at least one free and one paid course prepared (test content)                                          | Operator / Admin tester                 | Yes                     | Open   |
| E7  | Razorpay test-mode keys and webhook configured (AI-02)                                                                               | Client (Razorpay account) + operator    | For payment cases       | Open   |
| E8  | Google Meet credentials configured (AE-01, AE-02)                                                                                    | Client + operator                       | For automatic-Meet case | Open   |
| E9  | Authorised UAT approver named (X-05)                                                                                                 | Client                                  | Yes                     | Open   |
| E10 | Test window agreed                                                                                                                   | Client + Marvel's Techworks             | Yes                     | Open   |
| E11 | Smoke check by Marvel's Techworks on staging (login per role, one page per portal, health check)                                     | Marvel's Techworks                      | Yes                     | Open   |

## 6. Known UAT-specific constraints

- **Faculty on public pages:** the `/faculty` page's teacher list is fixed website content (`apps/web/src/content/faculty.ts`) that is empty until the academy supplies approved profiles (C-01, C-02). Adding one is a code change and a redeploy. Course pages name only faculty whose profile is marked public, and no screen exists to do that (Z-05). It would need a direct database change by the operator, which is not part of this plan unless the academy asks. Both empty states are expected.
- **Students self-register** through `/register`, which sends a real verification email. Testers must use mailboxes they control.
- **Free self-enrolment** works only for a published course whose price is exactly ₹0 (AA-01).
- **Faculty cannot publish courses**; admins publish (Z-11).
- **Released results are final** — a correction workflow does not exist (AB-05, AC-08). Testers should use test courses.

## 7. Test window and schedule

| Item                           | Value            |
| ------------------------------ | ---------------- |
| UAT start date                 | `<to be agreed>` |
| UAT end date                   | `<to be agreed>` |
| Kick-off / walkthrough session | `<to be agreed>` |
| Mid-point review               | `<to be agreed>` |
| Retest window for fixes        | `<to be agreed>` |
| Sign-off meeting               | `<to be agreed>` |

## 8. Responsibilities

| Responsibility                                         | Party                                               | Named person                          |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------- |
| Authorised approver (signs acceptance)                 | ASRA Academy                                        | `<to be named by the academy — X-05>` |
| UAT testers (admin, faculty, student roles)            | ASRA Academy                                        | `<to be named>`                       |
| UAT coordinator / release manager                      | Marvel's Techworks                                  | `<to be named>`                       |
| Environment operator (deploy, accounts, configuration) | Marvel's Techworks (or academy-authorised operator) | `<to be named>`                       |
| Triage and fixes                                       | Marvel's Techworks                                  | `<to be named>`                       |
| Payment, email, Google account owner                   | ASRA Academy                                        | `<to be named>`                       |

## 9. How testers work

1. Sign in with the account for your role (credentials handed over separately — never by this document).
2. Follow the cases for your role in [UAT-TEST-CASES.md](./UAT-TEST-CASES.md). Fill in **Actual outcome**, **Status** and **Evidence**.
3. Anything unexpected, unclear or wished-for goes in [UAT-FEEDBACK-LOG.md](./UAT-FEEDBACK-LOG.md) with a screenshot where helpful.
4. Use only test data. Never enter real student names, real card details or real personal documents.
5. Do not share test-account credentials.

Status values for test cases: **Not run** · **Pass** · **Fail** (link a feedback ID) · **Blocked** (prerequisite missing) · **Not applicable** (agreed out of scope).

## 10. Triage

Severity:

- **P0 — Critical:** system unusable, serious security incident, major data corruption, or equivalent release-blocking failure.
- **P1 — High:** core workflow broken or essential business functionality unreliable.
- **P2 — Medium:** feature issue with a reasonable workaround.
- **P3 — Minor:** cosmetic issue or low-impact usability concern.

Process for every feedback item:

1. Reproduce it on staging.
2. Classify: **Bug**, **Change Request**, **Content Correction** or **Design Feedback**. A request for new behaviour is a Change Request, not a bug.
3. Assess impact and severity. The severity a tester proposes is recorded; engineering's assessment is recorded separately.
4. Record the decision and owner.
5. Implement approved, in-scope fixes. Change Requests need the academy's explicit approval; scope is not expanded silently.
6. Add or update a regression test where appropriate.
7. Redeploy to staging and retest the affected workflow.
8. Ask the reporter to confirm where the outcome needs their acceptance.

## 11. Exit criteria

UAT is complete only when **all** of the following are true:

- [ ] Every agreed test case has a recorded actual outcome (Pass, Fail, Blocked or Not applicable — none left "Not run").
- [ ] No open P0.
- [ ] Every P1 affecting a critical workflow, security, payments or data integrity is resolved, or addressed by a documented decision of the authorised approver.
- [ ] Every open P2/P3 has an agreed disposition (fix before launch / fix after launch / won't fix).
- [ ] Client clarifications that affect scope have a recorded decision or an explicit exclusion in CLIENT-ACCEPTANCE §4.
- [ ] Approved fixes have been retested on staging.
- [ ] The approver has reviewed the known limitations (CLIENT-ACCEPTANCE §3).
- [ ] Acceptance or rejection is recorded and signed in [CLIENT-ACCEPTANCE.md](./CLIENT-ACCEPTANCE.md).

A completed test plan is not acceptance. A passing developer test suite is not acceptance.

## 12. Current blockers

| #   | Blocker                                                    | Blocks                                                 | Needed from                |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ | -------------------------- |
| B1  | No staging environment (W-01, W-06)                        | All UAT                                                | Client decision + operator |
| B2  | No verified email sender domain / Resend key (Q-02, AI-04) | Staging start-up, registration, password reset, emails | Client (DNS)               |
| B3  | No Razorpay test keys (AI-02)                              | Paid enrolment, payment status, refunds                | Client (Razorpay account)  |
| B4  | No Google Meet credentials (AE-01, AE-02)                  | Automatic Meet links only                              | Client                     |
| B5  | AI-01 not signed off; Phase 15 fixes not merged            | Choice of build under test                             | Technical approver         |
| B6  | Approver and test window not named (X-05)                  | Sign-off                                               | Client                     |
