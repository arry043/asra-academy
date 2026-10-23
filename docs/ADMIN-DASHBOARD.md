# ASRA Academy — Admin Dashboard & Analytics (Phase 12)

The administration portal (`/admin`) brings the modules of Phases 06–11 together: a database-backed dashboard, analytics reports, a user directory with account and role administration, cross-course operational lists and an administrative audit trail. It reuses the existing services, permissions and UI; no business workflow (enrolment, grading, payment, refunds, meetings, email) is reimplemented here.

**Principles**

- Every number is computed by the API from database rows. No KPI, trend or percentage is hard-coded or estimated; empty data shows an empty state.
- Every endpoint enforces authentication and a permission on the server. Hiding a menu item is never the security boundary.
- Money is integer minor units (paise) summed by PostgreSQL, per currency and per payment mode (test money never appears as live revenue).
- Calendar days are **India Standard Time (Asia/Kolkata)**, independent of server and browser zones (V-09).

---

## 1. Audit summary (state before Phase 12)

| Area                                                                    | Found                                                                      | Phase 12 action                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Admin shell, auth, RBAC (`requirePermission`, seeded roles/permissions) | Implemented (Phases 03, 06)                                                | Reused; navigation regrouped; `requireAnyPermission` added for per-target routes |
| Academic structure, courses, categories, curriculum                     | Implemented (Phase 06)                                                     | Reused unchanged; publication and faculty assignment now audited                 |
| Enrolments                                                              | Per course (Phase 07)                                                      | Global list added; admin enrol/cancel audited                                    |
| Orders, payments, refunds, revenue summary                              | Implemented (Phase 10)                                                     | Reused (`paymentsAdminService`); analytics read the same rows                    |
| Live classes + Google Meet + YouTube recordings                         | Implemented (Phase 11)                                                     | Reused; schedule/reschedule/cancel audited                                       |
| Assignments, quizzes, exams, attempts, results                          | Implemented (Phases 08–09)                                                 | Read-only admin overview; analytics use stored results                           |
| Notifications (in-app + Resend outbox)                                  | Implemented (Phase 11)                                                     | Delivery activity view added                                                     |
| Payment / assessment audit logs                                         | Implemented (Phases 09–10)                                                 | Shown in the audit viewer                                                        |
| General admin audit log                                                 | **Missing**                                                                | `admin_audit_logs` added                                                         |
| User management over HTTP                                               | **Missing** (operator CLI only)                                            | Directory, profile, status and role administration added                         |
| Certificates                                                            | **Missing** (Phase 13; L-01–L-03)                                          | Not built — documented (AF-07)                                                   |
| Coupons                                                                 | **Missing** (M-06 pending)                                                 | Not built — documented (AF-08)                                                   |
| Announcements                                                           | **Missing** (O-04/AE-08 pending)                                           | Not built — documented (AF-09)                                                   |
| Enquiries backend                                                       | **Missing** (Y-05 pending; the contact form opens the visitor's email app) | Not built — documented (AF-10)                                                   |
| Blog / CMS                                                              | **Missing** (empty `/blog` page; X-03 pending)                             | Not built — documented (AF-11)                                                   |
| Chart library                                                           | None                                                                       | Small dependency-free SVG/HTML charts (`components/admin/charts.tsx`)            |

## 2. Admin module map

Navigation is permission-aware (`buildNavigation` in `components/admin/admin-shell.tsx`). Each item is listed with the permission its API requires.

| Group         | Item                                                                       | Route                        | Permission                                                 |
| ------------- | -------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| —             | Dashboard                                                                  | `/admin`                     | `analytics.view` (otherwise shortcuts only)                |
| —             | Analytics                                                                  | `/admin/analytics/*`         | `analytics.view` (+ `payments.view` for Revenue)           |
| Users         | Students                                                                   | `/admin/students`            | `students.manage`                                          |
| Users         | Faculty                                                                    | `/admin/faculty`             | `faculty.manage`                                           |
| Users         | Administrators                                                             | `/admin/admins`              | `admins.manage`                                            |
| Users         | Account detail                                                             | `/admin/users/:id`           | per target (§6.1)                                          |
| Academic      | Academic levels, Classes, Streams, Subjects                                | existing                     | `academic_structure.manage`                                |
| Courses       | Courses (curriculum, content, faculty, enrolments, publishing), Categories | existing                     | `courses.manage` / `content.manage` / `enrollments.manage` |
| Learning      | Live classes                                                               | existing                     | `live_classes.manage`                                      |
| Learning      | Assessments (assignments, quizzes, exams)                                  | `/admin/assessments[/quizzes | /exams]`                                                   | `content.manage` |
| Commerce      | Orders & payments (orders, transactions, refunds)                          | existing `/admin/payments`   | `payments.view` (`payments.refund` to refund)              |
| Commerce      | Enrolments                                                                 | `/admin/enrollments`         | `enrollments.manage`                                       |
| Communication | My notifications                                                           | existing                     | any staff                                                  |
| Communication | Email delivery                                                             | `/admin/email-deliveries`    | `notifications.view`                                       |
| Settings      | Roles & permissions                                                        | `/admin/roles`               | `roles.manage`                                             |
| Settings      | Audit logs                                                                 | `/admin/audit-logs`          | `audit_logs.view`                                          |

Not listed because the module does not exist: Certificates, Coupons, Announcements, Enquiries, Blog (§9).

## 3. Dashboard KPIs (`GET /admin/dashboard`)

Requires `analytics.view`. Sections that expose more than counts need their own permission and are returned as `null` without it.

| KPI                    | Definition                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Students               | Accounts holding the STUDENT role (any status); sub-figure: ACTIVE accounts. Delta: accounts created in the last 30 days vs the 30 days before (rolling instants).                                             |
| Faculty                | Accounts holding the FACULTY role; ACTIVE sub-figure.                                                                                                                                                          |
| Courses                | All courses; published / draft / archived.                                                                                                                                                                     |
| Enrolments             | All enrolment rows (one per student and course); currently ACTIVE. Delta: enrolments whose latest activation is in the last 30 days vs the 30 before.                                                          |
| Net revenue (all time) | `payments.view` only. Captured − processed refunds, all time, in the active payment mode (else LIVE) — the Phase 10 summary. Sub-figure: net in the last 30 days vs the 30 before. Before Razorpay fees/taxes. |
| Upcoming live classes  | SCHEDULED classes that have not ended (start + duration in the future); of which starting in 7 days.                                                                                                           |
| Work awaiting grading  | Assignment submissions with status SUBMITTED + finalized quiz/exam attempts with evaluation PENDING.                                                                                                           |
| Examinations           | PUBLISHED exams open now + scheduled; plus those whose window ended without published results.                                                                                                                 |

Overview lists (5 rows each): recent registrations (`students.manage`), recent orders (`payments.view`), upcoming live classes, oldest submissions awaiting a grade (course and assignment only — no student names), upcoming/open exams, recent administrative activity (`audit_logs.view`). "Needs attention": permanently failed emails (`notifications.view`), captured payments needing review and failed payments in 7 days (`payments.view`), upcoming classes whose Google Meet link could not be created (`live_classes.manage`).

## 4. Analytics definitions

All reports: `analytics.view`. Filters are validated with Zod (`packages/validation/src/admin.ts`): `from`/`to` are inclusive `YYYY-MM-DD` days in IST (default: last 30 days ending today), at most **731 days**; `granularity` `day|week|month` (default: day ≤ 62 days, week ≤ 366, else month; daily buckets at most 366). Weeks are ISO weeks starting Monday; the first bucket may begin before `from`. Each response echoes the resolved range and the previous window of equal length.

| Report           | Endpoint                                       | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student growth   | `/admin/analytics/student-growth`              | Student accounts by `users.created_at` (account creation — not first enrolment or activity). Totals for the range, the previous window and all time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Enrolments       | `/admin/analytics/enrollments`                 | **New** = enrolments whose latest activation (`enrolled_at`) is in the range; **still active** = of those, not cancelled; **active now** = all ACTIVE enrolments. By source, top 10 courses, classes, subjects (from the course). Reactivation reuses the row and moves `enrolled_at`, so each student/course pair is counted once, at its latest activation.                                                                                                                                                                                                                                                                                                                                            |
| Popular courses  | `/admin/analytics/popular-courses`             | Ranked by new enrolments in the range, then active enrolments now, then title. Columns: active now, all enrolment rows, completed (ACTIVE with `completedAt`), completion % (completed ÷ active). Only courses with ≥ 1 enrolment. Revenue is not a popularity input; failed payments never create enrolments.                                                                                                                                                                                                                                                                                                                                                                                           |
| Revenue          | `/admin/analytics/revenue` (+ `payments.view`) | **Gross** = Σ payments CAPTURED in the range (by `captured_at`); **refunded** = Σ refunds PROCESSED in the range (by `processed_at`, partial refunds included); **net** = gross − refunded. Cash basis, one mode (`mode` param, default active mode else LIVE), per currency. Each provider payment is one row (unique provider id), so duplicate webhooks/reconciliations cannot double count. Orders, browser redirects, AUTHORIZED/FAILED attempts are never revenue. By course: via the payment's order. Status distribution: attempts created in the range by current status; failed attempts (`failed_at` in range); open orders created in the range. No taxes, fees or GST are computed (AD-05). |
| Completion       | `/admin/analytics/completion`                  | **Denominator** = ACTIVE enrolments (cancelled and never-enrolled excluded); **numerator** = those with `completedAt` (first time every counted lesson was completed, STUDENT-LMS §4). Default all time; with `from`/`to`, the cohort of enrolments activated in that range.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Exam performance | `/admin/analytics/exams`                       | Finalized attempts (SUBMITTED/EXPIRED) of non-DRAFT exams; with `from`/`to`, submitted in that range. Averages, pass rate and distribution use **EVALUATED** attempts only — pending manual grading is reported separately, never as 0. Scores are those stored by the assessment engine (negative marking, pass mark applied). Every attempt counts on its own (AC-01).                                                                                                                                                                                                                                                                                                                                 |
| Faculty activity | `/admin/analytics/faculty`                     | Per faculty member: current course assignments; distinct ACTIVE students in them; classes hosted that started in the range and were COMPLETED / CANCELLED; submissions graded (`graded_at` in range) and the median hours from the current version's submission to its latest grade; backlog now (SUBMITTED submissions + PENDING attempts in assigned courses); completion % across assigned courses. Operational counts, not ratings or rankings.                                                                                                                                                                                                                                                      |

Implementation: `apps/api/src/modules/admin/analytics.service.ts` — PostgreSQL aggregation (`count … FILTER`, `sum`, `percentile_cont`, `date_trunc(… AT TIME ZONE 'Asia/Kolkata')`), a fixed number of queries per report (no N+1), paginated rankings with `count(*) OVER ()`. No caching: figures are always current (financial data is never served stale).

## 5. API endpoints (all under `/api/v1/admin`, authenticated, `Cache-Control: no-store`)

| Method & path                                                         | Permission                         | Notes                                                                       |
| --------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `GET /dashboard`                                                      | `analytics.view`                   | §3                                                                          |
| `GET /analytics/student-growth`, `/enrollments`                       | `analytics.view`                   | `from`, `to`, `granularity`                                                 |
| `GET /analytics/popular-courses`, `/completion`, `/exams`, `/faculty` | `analytics.view`                   | + `page`, `pageSize`, `q`, `courseId`                                       |
| `GET /analytics/revenue`                                              | `analytics.view` + `payments.view` | + `mode`                                                                    |
| `GET /users?role=STUDENT                                              | FACULTY                            | ADMIN`                                                                      | the directory's permission | `q`, `status`, `sort`; students: `classId`, `enrollment=active                           | none` |
| `GET /users/:id`                                                      | per target (§6.1)                  | 404 when not permitted                                                      |
| `PATCH /users/:id/status`                                             | per target                         | `{ status, reason? }`                                                       |
| `POST /users/:id/roles`                                               | `roles.manage` + per target        | `{ role }`                                                                  |
| `DELETE /users/:id/roles/:role`                                       | `roles.manage` + per target        |                                                                             |
| `GET /roles`                                                          | `roles.manage`                     | role ↔ permission matrix (read-only)                                        |
| `GET /audit-logs`                                                     | `audit_logs.view`                  | `source=admin                                                               | payment                    | assessment`, `action`(exact or prefix ending in`.`), `actorId`, `entityId`, `from`, `to` |
| `GET /enrollments`                                                    | `enrollments.manage`               | all courses; `q`, `courseId`, `status`, `source`, `completed`, `from`, `to` |
| `GET /notifications/deliveries[/summary]`                             | `notifications.view`               | event, recipient name, state, safe error class — no addresses or bodies     |
| `GET /assessments/assignments                                         | quizzes                            | exams`                                                                      | `content.manage`           | `q`, `courseId`, `status`, `pending=true`                                                |

## 6. Authorization

### 6.1 Accounts

Which permission governs an account: ADMIN/SUPER_ADMIN (or no role) → `admins.manage`; else STUDENT → `students.manage`; else FACULTY → `faculty.manage`. Without it the account is reported as not found. Payment history additionally needs `payments.view`.

- **Status** (ACTIVE / INACTIVE / SUSPENDED): never your own account; the last ACTIVE Super Admin cannot be deactivated (Super Admin rows are locked during the check). A non-ACTIVE account is refused at sign-in, token refresh and on every request (status re-read each time), so access ends immediately.
- **Roles**: `roles.manage` required; never your own roles; a role can be granted or revoked only by someone holding **every permission of that role** (no escalation), and ADMIN/SUPER_ADMIN also need `admins.manage`; a user keeps at least one role; the last ACTIVE Super Admin keeps the role; FACULTY cannot be removed while course assignments exist. Granting STUDENT/FACULTY creates the empty profile those roles need.
- Role definitions themselves are read-only (custom roles pending S-01).

### 6.2 New permissions (seed)

| Permission           | Super Admin |   Admin   |
| -------------------- | :---------: | :-------: |
| `analytics.view`     |      ✓      |     ✓     |
| `notifications.view` |      ✓      |     ✓     |
| `audit_logs.view`    |      ✓      | — (AF-03) |

Run `npm run db:seed` on existing databases (additive) to grant them.

## 7. Audit logs

`admin_audit_logs` (`AdminAuditLog`) is written **in the same transaction** as the change, with the signed-in actor:

| Action                                                                           | Where                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| `user.status_changed` (`from`, `to`, `reason`)                                   | users.service                                      |
| `user.role_granted` / `user.role_revoked` (`role`, `rolesBefore`)                | users.service                                      |
| `course.published` / `unpublished` / `archived` / `restored`                     | courses.service                                    |
| `course.instructors_changed` (`before`, `after`)                                 | courses.service (only when the assignment changes) |
| `live_class.scheduled` / `rescheduled` / `cancelled` (`scope`: admin or faculty) | live-classes.service                               |
| `enrollment.created_by_admin` / `enrollment.cancelled_by_admin`                  | enrollments.service                                |

Payment events (`payment_audit_logs`, Phase 10) and assessment events (`assessment_audit_logs`, Phase 09) keep their own trails; the viewer reads all three. Entries contain ids, previous/new values and short reasons only — never passwords, tokens, keys, payment instrument data, email bodies. Append-only by construction: no code path updates or deletes entries and no endpoint writes them. Actions before Phase 12 were not recorded and are not back-filled.

## 8. Database

Migration `20261023090000_phase12_admin_dashboard` (additive): table `admin_audit_logs` (+ CHECKs on `action`/`entity_type` format, FK `actor_id` SET NULL), indexes `users(created_at)` and `enrollments(enrolled_at)` for the time series. See DATABASE.md §4.2.8, §4.3.

## 9. Known limitations and missing integrations

- **Certificates, coupons, announcements, enquiries, blog** do not exist in the codebase and their business rules are unconfirmed; nothing was built or faked (AF-07 – AF-11).
- **Staff onboarding** (creating faculty/admin accounts or invitations from the portal) is not built — accounts are still created with `npm run auth:create-user` (S-05).
- **Custom roles / editing role permissions** are not offered (S-01).
- **Enrolment history**: reactivation overwrites `enrolled_at`, so a re-enrolled student counts once, at the latest activation (AF-04).
- **Revenue** is cash-basis by event date and excludes fees/taxes; it is not an accounting or GST report (AF-05, AD-05). Free enrolments create no order (AD-07).
- **Audit immutability** is enforced by the application (no update/delete paths); database-level protection (restricted grants or triggers) is a deployment decision (AF-06).
- **Exports** (CSV/PDF) are not provided (not required; S-03).
- **Charts were verified** by unit tests and the production build; they were not visually reviewed in a browser in this environment.

## 10. Local setup and tests

```bash
npm run docker:up              # PostgreSQL + Redis
npm run db:migrate:deploy      # apply migrations (incl. Phase 12)
npm run db:seed                # grants the Phase 12 permissions
npm run auth:create-user -- --email you@example.com --name "You" --role SUPER_ADMIN
npm run dev                    # API :4000, web :3000 → /admin

npm test                       # API suite (real test database, no external services)
npm test -w @asra/web          # web unit tests
npm run lint && npm run typecheck && npm run build
```

Tests: `apps/api/tests/admin-dashboard-phase12.test.ts` (authorization, KPI counts, empty data, IST boundaries, new vs active enrolments, ranking, revenue with failures/refunds/duplicates/modes, completion denominator, ungraded exams, faculty scoping, escalation, last Super Admin, audit entries) and `apps/web/tests/admin-dashboard.test.tsx` (helpers, permission-aware navigation, chart states).
