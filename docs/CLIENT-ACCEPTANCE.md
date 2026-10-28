# ASRA Academy — Client Acceptance Record (PHASE 16)

Version 0.1.0 · 2026-10-28 · Plan: [UAT-PLAN.md](./UAT-PLAN.md) · Test cases: [UAT-TEST-CASES.md](./UAT-TEST-CASES.md) · Feedback: [UAT-FEEDBACK-LOG.md](./UAT-FEEDBACK-LOG.md) · Developer QA: [QA-REPORT.md](./QA-REPORT.md)

## Acceptance status: **Pending client sign-off**

UAT has not started, and no client decision has been recorded. Only the academy's authorised approver can change this status, by completing §6.

Allowed values: `Pending client sign-off` · `Accepted` · `Accepted with conditions` · `Rejected`.

---

## 1. Scope reviewed

The platform as described in the Project Development Order (excluding Section 7, Commercial Proposal), in the build recorded below.

| Item                    | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Build / commit accepted | `<to be recorded>`                                                                 |
| UAT environment         | `<staging URL — to be recorded>`                                                   |
| UAT period              | `<start> – <end>`                                                                  |
| Test-case outcome       | `<n> Pass · <n> Fail · <n> Blocked · <n> Not applicable` of 68 (UAT-TEST-CASES §7) |
| Feedback items          | `<n>` reported · `<n>` closed · `<n>` open (UAT-FEEDBACK-LOG §2)                   |

Modules in scope: public website and certificate verification; registration, sign-in and password reset; student learning, progress, assignments, quizzes, exams, results, certificates and notifications; faculty portal (content, assignments, grading, quizzes, exams, live classes); admin portal (academic structure, courses, enrolments, users, payments view, analytics, certificates, notifications, email deliveries); Super Admin functions (roles, audit logs, refunds) if tested; enrolment and payment in Razorpay **test mode** if configured.

## 2. Status by area

Fill in at the end of UAT. "Blocked" areas cannot be accepted; they are listed as exclusions or conditions in §3.

| Area                                            | UAT result  | Notes                                                                |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Public website                                  | `<pending>` |                                                                      |
| Student journey                                 | `<pending>` |                                                                      |
| Faculty portal                                  | `<pending>` |                                                                      |
| Admin portal                                    | `<pending>` |                                                                      |
| Super Admin functions                           | `<pending>` | Tested by approved account / demonstrated by operator / not reviewed |
| Online payment and refunds (Razorpay test mode) | `<pending>` | Blocked until test keys are provided (AI-02)                         |
| Email delivery                                  | `<pending>` | Requires verified sender domain (Q-02, AI-04)                        |
| Automatic Google Meet links                     | `<pending>` | Blocked until credentials are provided (AI-04)                       |
| Browsers / devices                              | `<pending>` | Only Chrome tested by developers (AI-03)                             |

## 3. Known issues, limitations and exclusions

The approver confirms they have reviewed this list by signing §6.

### 3.1 Not implemented (excluded from this acceptance unless separately agreed)

File uploads and storage (assignments are text + link; lesson media are links) · coupons · announcements · enquiry inbox (contact form opens the visitor's email app) · blog/CMS · staff invitations from the portal (staff accounts are created by the operator) · parent/guardian accounts and guardian consent capture · admin sub-roles · WhatsApp, SMS, push notifications and reminders · email-provider webhooks · attendance tracking · automatic meeting recordings · GST tax invoices (a payment receipt is issued) · CSV/PDF report exports · correcting results after release · public faculty profiles managed from the portal.

### 3.2 Not yet verified by anyone

- Live Razorpay payments; Razorpay test mode until UAT-FLOW-03 … 05 pass.
- Real email delivery until verified on staging.
- Google Meet automatic links.
- Firefox, Safari and real devices until tested in UAT.
- Production performance, load capacity; no penetration test was performed.

### 3.3 Open defects from developer QA

QA-DEF-05, 06, 07, 08, 09 (P3, open) and QA-DEF-10 (P3, partly fixed); see [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md). QA-DEF-03 (P1) is fixed but awaits technical sign-off (AI-01).

### 3.4 Open UAT feedback at sign-off

| Feedback ID                     | Category | Severity | Agreed disposition |
| ------------------------------- | -------- | -------- | ------------------ |
| `<to be completed at sign-off>` |          |          |                    |

## 4. Outstanding decisions

Every item below must be **decided**, **explicitly excluded**, or **accepted as the current default** before sign-off. Accepting UAT does not confirm any default the approver has not ticked here.

| ID                     | Decision needed                                                            | Current default                     | Approver's decision                            |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| AI-01                  | Approve the session-refresh rate-limit change (QA-DEF-03)                  | Fixed in code, unmerged             | `<pending>`                                    |
| AI-02 / W-06           | Staging with Razorpay test keys; paid courses at launch (M-01)             | Paid courses not live until tested  | `<pending>`                                    |
| AI-03                  | Supported browsers and devices                                             | Latest Chrome-based verified        | `<pending>`                                    |
| AI-04 / Q-02           | Email sender domain; Google Meet credentials                               | Disabled unless configured          | `<pending>`                                    |
| AI-05                  | Accept remaining P3 defects for post-launch fixing                         | Deferred                            | `<pending>`                                    |
| AI-06                  | Decorative gold numbers: keep or darken                                    | Kept                                | `<pending>`                                    |
| AH-01                  | Full student name on public certificate pages (minors)                     | Full name shown, not indexed        | `<pending>`                                    |
| AH-02                  | Revocation reason shown publicly                                           | Shown                               | `<pending>`                                    |
| AH-03                  | Certificates for courses later unpublished                                 | Allowed                             | `<pending>`                                    |
| E-01 … E-05            | Guardian details and consent for under-18s (DPDP Act 2023)                 | Not captured                        | `<pending>`                                    |
| U-01 / U-02            | Legally reviewed Privacy, Terms, Refund text; grievance contact            | Placeholder text                    | `<pending>`                                    |
| Y-01                   | Approval of public website copy                                            | Provisional copy                    | `<pending>`                                    |
| AG-01 … AG-05          | Certificate courses, eligibility, signatories, design                      | Defaults per CERTIFICATE-SYSTEM.md  | `<pending>`                                    |
| AA-04 / A-07           | Progress rule                                                              | Completed lessons ÷ counted lessons | `<pending>`                                    |
| AC-01 … AC-16          | Assessment rules                                                           | Proposed defaults                   | `<pending>`                                    |
| AD-01 … AD-09          | Refund, pricing and receipt rules                                          | Proposed defaults                   | `<pending>`                                    |
| AF-03                  | Who may read audit logs; retention                                         | Super Admin only; kept indefinitely | `<pending>`                                    |
| W-01, W-03, W-04, W-05 | Production hosting, Redis, domain, backups                                 | Pending                             | `<pending>`                                    |
| Other                  | All remaining `PENDING CLIENT CONFIRMATION` items in CLIENT-CLARIFICATIONS | Implemented defaults                | `<pending: accept defaults / list exceptions>` |

## 5. Exit-criteria check

To be completed by the UAT coordinator before requesting signature (UAT-PLAN §11).

| Criterion                                                  | Met?        | Reference           |
| ---------------------------------------------------------- | ----------- | ------------------- |
| Every agreed test case has a recorded outcome              | `<pending>` | UAT-TEST-CASES §7   |
| No open P0                                                 | `<pending>` | UAT-FEEDBACK-LOG §2 |
| Critical P1s resolved or covered by an authorised decision | `<pending>` |                     |
| Open P2/P3 have an agreed disposition                      | `<pending>` | §3.4                |
| Scope-affecting clarifications decided or excluded         | `<pending>` | §4                  |
| Approved fixes retested                                    | `<pending>` |                     |
| Known limitations reviewed by approver                     | `<pending>` | §3                  |

## 6. Sign-off

Completed only by the academy's authorised approver (CLIENT-CLARIFICATIONS X-05). A name typed here by anyone else is not acceptance. Attach or reference the approver's written confirmation, e.g. a signed copy or an email from the approver.

| Field                                      | Value                                               |
| ------------------------------------------ | --------------------------------------------------- |
| Acceptance decision                        | `Pending client sign-off`                           |
| Conditions (if "Accepted with conditions") |                                                     |
| Reasons (if "Rejected")                    |                                                     |
| Authorised approver — name                 | `<pending>`                                         |
| Role / title                               | `<pending>`                                         |
| Organisation                               | ASRA Academy                                        |
| Approval date                              | `<pending>`                                         |
| Evidence of decision                       | `<reference to signed document or email — pending>` |
| Sign-off comments                          |                                                     |

Acknowledged for Marvel's Techworks:

| Field       | Value       |
| ----------- | ----------- |
| Name / role | `<pending>` |
| Date        | `<pending>` |
