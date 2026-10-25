# Changelog

All notable changes to the ASRA Academy platform are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Pre-1.0 minor versions correspond to development phases.

Entry template:

```
## [x.y.z] — YYYY-MM-DD
**Phase:** NN — Name
**Status:** ...
### Added / Changed / Deprecated / Removed / Fixed / Security
```

---

## [Unreleased]

### Security — PHASE 14 SEO, Security & Performance Hardening (uncommitted, pending review)

- Review, findings and remaining risks: [SECURITY.md](./SECURITY.md); measurements: [PERFORMANCE.md](./PERFORMANCE.md). Internal code/configuration review with tests — not a penetration test, nothing verified on a deployment.
- Fixed (SEC-01): public certificate verification called `/api/v1/api/v1/…` and reported every genuine certificate as "not found". Lookups now go through `apiRequest` (`apps/web/src/lib/certificates.ts`), and an outage shows "Verification unavailable" instead of "not found".
- Fixed (SEC-02): `body-parser` 2.3.0 → 2.4.0 (GHSA-27r3-jxmh-p828, compressed-body DoS; runtime via Express). Lockfile only, within Express's range; `qs` 6.16.0 → 6.16.1 with it.
- Added (SEC-03): web security headers for documents — CSP without nonces (API origin, Razorpay Checkout and YouTube-nocookie/Vimeo explicitly allowed; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP `same-origin-allow-popups`, HSTS on HTTPS production builds (`apps/web/src/config/deployment.ts`). Build assets under `/_next` get `nosniff` only. Zod runs `jitless` in browsers so its eval probe no longer triggers CSP reports.
- Fixed (SEC-04): concurrent certificate claims returned 500 (unique violation inside an interactive transaction). Issuance now locks the enrolment row; the certificate number is checked before insert and drawn uniformly (`crypto.randomInt`).
- Fixed (SEC-05): `/verify/<id>` pages are `noindex`; titles/descriptions no longer contain the recipient's name or course, and malformed ids are not reflected into metadata.
- Fixed (SEC-06): `safeNextPath` refuses control characters and backslashes (`/\t/evil` → `//evil` after URL parsing) and requires a same-origin parse.
- Changed (SEC-07): every API response defaults to `Cache-Control: no-store`; only successful public catalogue reads send `public, max-age=0, s-maxage=60, stale-while-revalidate=60`.

### Added — PHASE 14 SEO

- `GET /api/v1/sitemap/courses`: slug + `updatedAt` of published PUBLIC courses (bounded, `s-maxage=300`), mounted outside `/courses` so it cannot shadow a slug. `sitemap.xml` lists those courses with `lastModified`, plus `/verify`; hourly ISR with a static fallback when the API is unreachable.
- `Course` JSON-LD on special-course programme pages and on published course pages with a summary/description (name, description, URL, provider, real thumbnail — no prices, ratings or outcomes). Course thumbnails are used as the page's Open Graph/Twitter image.
- robots.txt (when indexing is enabled) also disallows `/admin`, `/student` and `/faculty`. The build fails when `SITE_INDEXING_ENABLED=true` and `NEXT_PUBLIC_APP_URL` is not an https production origin (localhost, private IPs, `*.vercel.app`).

### Changed — PHASE 14 Performance & accessibility

- Logo images declare accurate `sizes`: phones fetched the 2048 px footer logo (160 KB) for a 112 px slot — now 26 KB; home hero 87 → 42 KB.
- Portal brand link has an accessible name when its text is hidden (Lighthouse accessibility 96 → 100 on student/faculty portals).
- No database migration or index: no measured query justified one (PERFORMANCE.md §4).
- Tests: `apps/api/tests/hardening-phase14.test.ts` (5), a concurrency test in `certificates.test.ts`, `apps/web/tests/hardening-phase14.test.tsx` (17), redirect cases in `course-management.test.tsx`; sitemap/robots expectations updated. Client questions: CLIENT-CLARIFICATIONS §AH; Z-09 updated.

### Added — PHASE 13 Certificate System (uncommitted, pending review)

- Certificate lifecycle engine: course completion verification, server-side eligibility check, idempotent certificate issuance with unique tamper-resistant public IDs (`ASRA-YYYY-XXXX-XXXX`), frozen student name and course title snapshots, PDF generation, and public verification. See [CERTIFICATE-SYSTEM.md](./CERTIFICATE-SYSTEM.md).
- Server-side eligibility engine (`certificates.service.ts`): enforces active student enrolment, 100% curriculum completion (or completion recorded at `completedAt`), and passing status on all published examinations (`passed = true`, with no pending subjective grading).
- Publication-grade PDF rendering (`pdf.service.ts`): built with `pdfkit` in landscape A4 format matching ASRA Academy brand tokens (deep emerald `#012114`, forest green `#034729`, warm gold `#c88717`, ivory `#fdfbf7`, vector decorative guilloche-style borders, official academy seal, and authorized signatory blocks).
- Student Portal integration (`/student/certificates`): list earned credentials, download high-resolution PDF, copy verification link, and view credential details.
- Public Verification (`/verify` and `/verify/:certificateId`): search and verify certificates by public ID with responsive verification card, authenticity badge, issue date, recipient name, course title, and revocation alerts. Sensitive student data (emails, phone numbers, database UUIDs) is strictly redacted. Public endpoint is rate-limited (`RATE_LIMIT_CERTIFICATES_VERIFY`).
- Administrator Portal (`/admin/certificates`): search and filter all issued and revoked certificates, download certificate PDFs, and revoke credentials with mandatory administrative reason and append-only audit logging (`admin_audit_logs`).
- Permissions: `certificates.view` granted to Student, Faculty, Admin, and Super Admin; `certificates.manage` granted to Admin and Super Admin.
- Migration `20261025090000_phase13_certificate_system` (additive: `certificates` table, enum `certificate_status`, unique enrollment constraint, format check constraints, revocation consistency constraint, listing indexes).
- Automated tests: `apps/api/tests/certificates.test.ts` (15 tests covering eligibility, idempotent issuance, student downloads, public verification, and admin revocation).

### Added — PHASE 12 Admin Dashboard & Analytics (uncommitted, pending review)

- Admin dashboard (`/admin`, `GET /api/v1/admin/dashboard`): database-backed KPIs (students, faculty, courses, enrolments, net revenue, upcoming live classes, work awaiting grading, examinations) with 30-day comparisons, permission-scoped overview lists and a "needs attention" panel. See [ADMIN-DASHBOARD.md](./ADMIN-DASHBOARD.md).
- Analytics (`/admin/analytics/*`): student growth, enrolments (new vs active, by course/class/subject/source), popular courses, revenue (captured − processed refunds, per mode and currency), completion rate (ACTIVE-enrolment denominator), exam performance (evaluated attempts only; pending grading separate), faculty activity (operational counts). PostgreSQL aggregation, IST calendar days, validated date ranges (≤ 731 days). Dependency-free accessible charts with table views.
- User administration: student/faculty/admin directories, account detail (enrolments with progress, orders, teaching), status changes and role grant/revoke with server-side escalation guards (no self-changes, subset-of-own-permissions rule, last active Super Admin protected). Read-only roles & permissions matrix.
- Administrative audit log (`admin_audit_logs`) written in the same transaction for account status/roles, course publication and faculty assignment, live-class schedule/reschedule/cancel and manual enrolments; audit viewer over the admin, payment and assessment trails.
- Cross-course lists: enrolments, assessments (assignments, quizzes, exams), email delivery activity.
- Permissions `analytics.view`, `notifications.view` (Admin, Super Admin) and `audit_logs.view` (Super Admin) — run `npm run db:seed`. `requireAnyPermission` middleware.
- Migration `20261023090000_phase12_admin_dashboard` (additive: audit table, `users(created_at)` and `enrollments(enrolled_at)` indexes). Tests: `admin-dashboard-phase12` (API), `admin-dashboard` (web). Client questions: CLIENT-CLARIFICATIONS §AF.

### Changed — PHASE 12

- Admin navigation regrouped (Dashboard, Users, Academic, Courses, Learning, Commerce, Communication, Settings); the old overview became the dashboard. Course transition, faculty-assignment, live-class and enrolment-cancel services accept the acting user for auditing; their behaviour is otherwise unchanged.

### Added — PHASE 11 Live Classes & Notifications (uncommitted, pending review)

- Live classes: administrator management (`/admin/live-classes`, new permission `live_classes.manage` for Admin), host assignment restricted to the course's faculty, explicit time zone (IST), `COMPLETED` status, manual YouTube recording links (validated and normalised, shown only to enrolled students), student upcoming/past views with Join and Recording actions, per-course section. See [LIVE-CLASSES.md](./LIVE-CLASSES.md).
- Google Meet adapter behind a provider port (`POST meet.googleapis.com/v2/spaces`, OAuth refresh token, scope `meetings.space.created`), with a database claim that prevents duplicate meetings, honest failure reporting and an explicit retry. Disabled unless `GOOGLE_MEET_CLIENT_ID/SECRET/REFRESH_TOKEN` are set. **Not verified against Google** (no credentials).
- Notifications: in-app inbox (`/api/v1/notifications`, bell + page in all portals) and Resend email through a transactional outbox with idempotent creation, claimed sends, Resend idempotency keys, bounded retries with backoff, permanent-failure handling and a sweep worker. Wired to registration, free/admin enrolment, payment and refund (in-app; existing emails kept), live classes, assignment publication and result release, exam publication, exam/quiz results. Branded HTML + text template. See [NOTIFICATIONS.md](./NOTIFICATIONS.md).
- Migration `20261020090000_phase11_live_classes_notifications` (additive). Tests: `live-classes-phase11`, `notifications`, `google-meet-provider`, env (API); `live-classes-notifications` (web). Client questions: CLIENT-CLARIFICATIONS §AE.

### Added — PHASE 10 Enrolment & Payment (uncommitted, pending review)

- Razorpay integration with explicit **test and live modes** (`RAZORPAY_MODE`, separate `RAZORPAY_TEST_*` / `RAZORPAY_LIVE_*` keys and webhook secrets; key-prefix and mode checks at startup; live refused outside production; each order bound to the mode it was created in). See [PAYMENTS.md](./PAYMENTS.md).
- Separate `Order` → `Payment` → `Enrollment` (+ `Refund`) model with frozen price snapshots in integer paise, one open order per student and course, and a single transactional, idempotent payment-application/enrolment-activation service.
- Checkout: server-side pricing (course discount), order creation with Razorpay Orders API, Checkout signature verification, server re-fetch of the payment, capture of authorised payments, status refresh, receipts; never activates from the browser callback alone.
- Signed webhooks over the raw body (`/api/v1/payments/webhooks/razorpay/:mode`), durable dedup by `x-razorpay-event-id`, leased processing, monotonic states (late failures never undo a capture), mode isolation.
- Reconciliation on demand and in a restart-safe background sweep (orders, refunds, unsent confirmation emails).
- Refunds (full/partial, `receipt` idempotency, crash-safe REQUESTED state, optional explicit access revocation), admin finance views (`/admin/payments`: summary per mode, orders, transactions, failed/needs-review, refunds, order detail with audit), student payment history and printable receipt.
- Permissions `payments.make_own` (Student), `payments.view` (Admin), `payments.refund` (Super Admin). Emails: payment confirmation and refund processed (sent once, after commit).
- Migration `20261019090000_phase10_enrolment_payment` (additive). Tests: `payments`, `payments-unit` (API), `payments.test.ts` (web).

### Changed — PHASE 10

- Course access state `PURCHASE` and server-computed `price` on student course overview/catalogue; `GET /student/features` reports payments available only when checkout is configured. Public course pages show **Enrol now**; login/registration keep the return path (`?next=`) through email verification.
- Client clarifications §AD added.

### Added — PHASE 09 Assessment Engine (uncommitted, pending review)

- Quizzes on QUIZ lessons (MCQ, True/False, multiple answers; time limit, attempts, pass mark, negative marking, random subset, shuffling, immediate or published results, answer reveal), scheduled examinations (window, duration, attempts, written answers with manual grading, result publication) and a shared attempt engine with immutable per-attempt snapshots. See [ASSESSMENTS.md](./ASSESSMENTS.md).
- Server-controlled exam timing: one deadline rule `min(start + duration, closesAt)`, injectable server clock, row-locked answer saves and finalization, idempotent submit, advisory-locked attempt starts, lazy expiry on every touch plus a restart-safe background sweep (`FOR UPDATE SKIP LOCKED`).
- API: `/faculty/quizzes…`, `/faculty/exams…`, `/faculty/questions/:id`, `/faculty/attempts/:id`, `/faculty/attempt-answers/:id/grade`; `/student/lessons/:id/quiz…`, `/student/exams…`, `/student/attempts/:id…`, `/student/assessment-results`. Per-user rate limits on start/answer/submit.
- Portals: faculty quiz/exam workspaces (rules, question editor with preview, lifecycle, attempts, grading, result publication); student quiz panel, exam pages and attempt player (server-corrected countdown, autosave with retry, offline state, auto-submit); quiz/exam results on `/student/results`.
- Assignments: per-assignment late and resubmission policy, server-decided stored `late` flag, archived versions, private faculty note, audited grade history.
- Migration `20261017090000_phase09_assessment_engine` (additive, with `late` back-fill and 33 CHECK constraints); `assessment_audit_logs`.
- Tests: `assessment-scoring` (pure), `quizzes`, `examinations` (21 mandatory timing/integrity scenarios), `assignments-phase09` (API); `assessments.test.tsx` (web).

### Changed — PHASE 09

- `GET /student/features` and `GET /faculty/features` report quizzes and exams as available; student dashboard counts open/upcoming exams.
- Curriculum: deleting a QUIZ lesson or changing its type is refused (409) once the quiz has attempts. Courses with examinations cannot be deleted (archive instead).
- Client clarifications §AC added.

### Added — PHASE 08 Faculty Portal (uncommitted, pending review)

- Faculty portal `/faculty/*` (dashboard, courses + course workspace, content, students, live classes, assignments, submissions + review, quizzes/exams status, performance, profile) on the existing design system; faculty land on `/faculty/dashboard` after sign-in. See [FACULTY-PORTAL.md](./FACULTY-PORTAL.md).
- API `/api/v1/faculty/*` (FACULTY role + per-route permission + `CourseInstructor` assignment via `accessPolicy.assertTeachesCourse`); curriculum routes mounted for faculty over the existing curriculum service (`content.manage_assigned`).
- Assignments → submissions → marks + feedback → explicit result release; student submission panel in assignment lessons, `/student/results`, scheduled classes on `/student/classes` (`/student/lessons/:id/assignment`, `/student/lessons/:id/submission`, `/student/results`, `/student/live-classes`).
- Provider-neutral live-class scheduling (IST input, optional manual meeting link, cancel; no provider API, no fabricated links).
- Migration `20261016102329_phase08_faculty_portal` (additive): `assignments`, `assignment_submissions`, `live_class_sessions`, enums `submission_status`, `live_class_status`, nine CHECK constraints. Permissions `students.view_assigned`, `submissions.grade_assigned`, `live_classes.manage_assigned` (FACULTY, SUPER_ADMIN; re-run `npm run db:seed`).
- Tests: `apps/api/tests/faculty-portal.test.ts` (17), `apps/web/tests/faculty-portal.test.tsx`.

### Changed — PHASE 08

- Curriculum: deleting an assignment lesson or changing its type is refused (409) while students have submitted work.
- Curriculum editor and lesson dialog take their API prefix from `CurriculumApiBase` (`/admin` default, `/faculty` in the portal) — one editor for both portals.
- `GET /student/features`: `assignmentSubmissions`, `results` and `liveClasses` are now available (test updated accordingly).
- Client clarifications §AB added.

### Added — PHASE 07 Student LMS (uncommitted, pending review)

- Migration `20261016083843_phase07_student_lms` (additive): `enrollments` (ACTIVE/CANCELLED, FREE/ADMIN source, resume lesson, last activity, completion date) and `lesson_progress` (viewed/completed timestamps, server-bounded video telemetry); unique `(user, course)` and `(user, lesson)`; four CHECK constraints. Permission `enrollments.manage` (ADMIN, SUPER_ADMIN; re-run `npm run db:seed`).
- `accessPolicy.assertCanViewCourseContent`: `content.view_enrolled` + PUBLISHED course + ACTIVE enrolment, resolved from the database on every protected lesson/resource/progress endpoint.
- API module `student` under `/api/v1/student` (role STUDENT): dashboard, features, courses, enrolment records, catalogue, free self-enrolment, course overview/curriculum/progress, lessons (player payload, resources, activity, complete/reopen, video heartbeat), lessons by type, history, profile (name/phone only). Admin `enrollments` endpoints: list, enrol by email, cancel.
- Student portal `(student)`: `/student/dashboard`, `courses`, `courses/[courseId]`, `learn/[courseId]`, `classes`, `assignments`, `quizzes`, `exams`, `progress`, `results`, `certificates`, `profile`, `payments`, `history`. Course player with curriculum sidebar/drawer, video player with throttled heartbeats, study materials, mark complete, previous/next, resume. Admin course detail gains an **Enrolments** tab. Students are sent to their dashboard after sign-in.
- Deferred with honest unavailable states (no fake data): quiz attempts, assignment submissions, exams, results (PHASE 09), payments (PHASE 10), live classes (PHASE 11), certificates (PHASE 13).
- Tests: 25 API tests (`student-lms`, `progress-rules`) and 15 web tests. Docs: STUDENT-LMS.md; client clarifications AA-01…AA-10.

### Changed — PHASE 07

- Course deletion is refused (409) while enrolments exist.
- `/login` signed-in card links students to their dashboard (was "coming soon").

### Added — PHASE 06 Academic & Course Management (uncommitted, pending review)

- Migration `20261015071102_phase06_course_management` (additive): course `visibility` (`PUBLIC`/`UNLISTED`/`PRIVATE`), `thumbnail_url`, `duration_minutes`, `price_minor` + `currency`, `discount_type` + `discount_value`; lesson types `PDF`, `QUIZ`, `ASSIGNMENT`; nine CHECK constraints; index `courses(status, visibility)`.
- API modules `academics`, `courses`, `curriculum` under `/api/v1/admin` (permission per route: `academic_structure.manage`, `courses.manage`, `content.manage`; `accessPolicy` per course): CRUD for academic levels, classes, streams, subjects, categories and courses; faculty assignment; publish/unpublish/archive/restore with publication rules; modules, chapters, lessons and resource links with ordering. Public `GET /api/v1/courses` and `/courses/:slug` (published + visibility only).
- Shared Zod schemas (`@asra/validation`: academics, courses, curriculum; `safeExternalUrlSchema`, `slugify`) and DTO types (`@asra/types` catalog).
- Admin portal `/admin` (route group `(admin)`): overview, catalogue managers, course list/form/detail with Publishing, Details, Faculty and Curriculum tabs; `Textarea` primitive; `/login?next=` redirect (same-site paths only).
- Public site: "Available courses" on `/courses`; published course pages at `/courses/<slug>`.
- Tests: 62 API tests (academics, courses, curriculum, public catalogue, end-to-end acceptance) and 21 web tests. Docs: COURSE-MANAGEMENT.md; client clarifications Z-01…Z-11.

### Changed — PHASE 06

- `/courses` and `/courses/[slug]` render per request (previously static); programme slugs are reserved for programme pages.
- `resourceInputSchema` accepts only `https://` URLs on public domains without credentials (was http/https).
- `ApiClientError.fieldErrors` also reads 409 field conflicts; `apiRequest` re-throws Next.js control-flow errors instead of reporting them as network errors.
- API test reset rebuilds role grants from the seed, so a runtime grant in one suite no longer leaks into later suites.

### Added

- Resend email transport (`EMAIL_TRANSPORT=resend`, SDK `resend@6.31.0`). Provider errors, network failures and timeouts (10 s) are raised as delivery failures; errors carry only Resend's code and status.
- `EMAIL_API_KEY` is now validated: required (non-empty) when `EMAIL_TRANSPORT=resend`, together with an `EMAIL_FROM` on a real, non-localhost domain. `apiKey`/`EMAIL_API_KEY` are redacted from logs.
- Tests: Resend transport (mocked client, no network), environment validation (`parseEnv`), and recovery after a rejected verification or reset email.

### Changed

- Production startup guard: refuses `console`, `memory` or an unset transport instead of refusing every configuration; it starts only with a complete Resend setup.
- Q-01 resolved: Resend selected. Q-02 (sender domain and DNS) is still pending.

### Fixed

- Removed the `helmet` `paths` pin from `apps/api/tsconfig.json`: `tsx` applies `paths` at runtime, so the dev server and API tests loaded Helmet's type-only `index.d.mts` and failed. `apps/api/src/app.ts` now types the Helmet default import explicitly, which still satisfies Vercel's Express-builder type check.

### Added — PHASE 05 Public Website (uncommitted, pending review)

- Public route group `apps/web/src/app/(public)`: shared layout (Navbar, `<main id="main-content">`, Footer), page transition template and error boundary. No auth provider, so public pages make no API calls.
- Routes: `/`, `/about`, `/courses`, `/classes/6-10`, `/classes/11-12`, `/courses/{english,entrepreneurship,quranic-studies,arabic,urdu}`, `/faculty`, `/admission`, `/contact`, `/blog`, `/privacy-policy`, `/terms`, `/refund-policy`. The existing `/login` is unchanged and linked from the header. Special courses and class bands share one `ProgrammePage` template via `courses/[slug]` and `classes/[band]` (`generateStaticParams`, `dynamicParams = false`, so unknown slugs return 404).
- Homepage sections in reference order: Hero, Platform Highlights, Courses, Why ASRA, Live Classes, Faculty, Learning Process, Testimonials, CTA.
- Typed public content in `src/content/`: programme catalogue from the Project Development Order §2 only; empty lists for faculty, testimonials, live classes and blog (honest empty states); legal outlines marked "pending approval" with no commitments.
- Course directory: case/accent-insensitive multi-word search plus category filter, combined; URL-synced (`?q=`, `?category=`) without history spam; result count live region; clear-filters; empty state; server-rendered full list as the Suspense fallback.
- Contact form: shared `enquirySchema` (new in `@asra/validation`), inline accessible errors with focus on the first invalid field, `?topic=` preselection. There is no enquiry API, so a valid form opens the visitor's email app addressed to the confirmed email and the page never claims delivery.
- WhatsApp click-to-chat (`WhatsAppLink`, `lib/whatsapp.ts`), configured by `NEXT_PUBLIC_WHATSAPP_NUMBER` (validated). It renders nothing while unset.
- SEO: `buildPageMetadata` (unique title and description, canonical, Open Graph, Twitter per page), `app/sitemap.ts` (16 indexable routes; excludes auth pages, design system and the empty blog), `app/robots.ts`, and JSON-LD (EducationalOrganization and WebSite on home, BreadcrumbList on inner pages) from confirmed facts only, escaped against `</script>`.
- `SITE_INDEXING_ENABLED` (build-time, default off): controls root `meta robots` and robots.txt so preview/staging builds are never indexed.
- Navbar: optional `children` on `NavItem` render a keyboard-accessible disclosure menu on desktop (Escape, outside click and focus-out close it) and a grouped list in the drawer; new `secondaryCta` prop (Login). Existing props are unchanged.
- CourseCard: optional `icon` and `tone` for the imageless cover panel. Defaults are unchanged.
- Tests: `apps/web/tests/public-website.test.tsx` adds 38 tests: filter logic, URL state, WhatsApp/mailto encoding, enquiry schema, metadata, JSON-LD escaping, sitemap and robots, no dead navigation links, and pending legal/provisional programme content.
- Docs: new `docs/PUBLIC-WEBSITE.md`; ARCHITECTURE (structure, ADR-021–023), REQUIREMENTS statuses, CLIENT-CLARIFICATIONS section Y (Y-01–Y-06), README and `.env.example`.

### Changed

- The Phase 04 foundation page (`app/page.tsx`, API status card) is replaced by the real homepage in `app/(public)/page.tsx`.
- Root layout `robots` is env-driven (previously always `noindex`).
- `config/navigation.ts`: Home removed from the header (the brand mark links home); Courses has sub-links generated from the catalogue; the footer gains Blog and Student login.
- Web test fixture in `components.test.tsx` now uses an external URL for the `Button asChild` case, because `/courses` now exists and `@next/next/no-html-link-for-pages` flags a raw `<a href="/courses">`.

---

## [0.4.0] — 2026-10-14

**Phase:** 04 — Design System & Frontend Foundation
**Status:** Implemented (uncommitted, pending review)

### Added — Design tokens (`apps/web/src/app/globals.css`)

- Brand scales: ASRA green, gold, ivory, warm white, ivory deep, dark text (ink) and muted green (sage), sampled from the logo. Official codes are pending (V-02).
- Semantic tokens: `primary`, `secondary`, `accent`, `muted`, `card`, `popover`, `border`, `input`, `ring`, `heading`, plus `success`, `warning`, `info` and `destructive` with `-foreground` and `-soft` variants. Every text pair meets WCAG AA, and the `input` border is 3.3:1.
- Six category tones (`tone-*`) taken from the reference's pastel course tiles.
- Typography roles as utilities: `type-display`, `type-h1`–`type-h4`, `type-body-lg/body/body-sm`, `type-caption`, `type-label`, `type-eyebrow` (fluid `clamp()` sizes).
- Layout tokens: `max-w-page/narrow/prose-content`, `px-gutter`, `py-section`, `h-control-sm/control/control-lg`, `sidebar` and `topbar` sizes. Elevation tokens: `shadow-card/raised/overlay`.
- Motion tokens: `ease-standard/emphasized`, `animate-fade-in/fade-up/scale-in/page-in`, and a `reveal` scroll-driven utility. The reduced-motion rule now also stops infinite loops and disables reveal.
- `cn()` taught the custom tokens (`extendTailwindMerge`). New helpers: `getInitials`, `clampProgress`, `toPercent`.

### Added — Components

- Core (`components/ui`): Badge, Alert, Field, PasswordInput, SearchInput, Select, Dialog (modal), Drawer, Tabs, Accordion, Table (+ `TableEmpty`, labelled scroll region), Pagination (link or callback mode), Toast (Radix Toast + `toast.*` API, `<Toaster/>` in the root layout), Tooltip, Avatar (fallback + status), Progress (clamped, no fake "indeterminate"), Skeleton (+ `LoadingRegion`).
- Restyled: Button (pill shape; `accent`, `icon-sm`; `loading`/`loadingText`), Input, Label, Card (`flat`/`muted`/`brand` variants, `interactive`, `CardAction`, semantic `CardTitle` heading).
- Education (`components/asra`): CourseCard (+ skeleton), FacultyCard, FeatureCard, CourseCategoryCard, TestimonialCard, LiveClassCard, AssignmentCard, ExamCard, ProgressCard. They are typed, presentational and safe with missing or invalid data. The Join link appears only for live sessions with an http(s) URL.
- Layouts (`components/layout`): Container, Section, Navbar (mobile drawer), Footer, Sidebar, DashboardLayout, AdminLayout, PageHeader (breadcrumbs), BrandMark, SkipLink, PageTransition.
- `lib/format.ts` (dates in `Asia/Kolkata`, durations, safe external URLs), `lib/pagination.ts`, `lib/navigation.ts`, `lib/feature-flags.ts`, `config/navigation.ts` (planned Phase 05 routes), `types/education.ts`.

### Added — Showcase

- `/design-system`: brand, components, education cards, layouts, motion and responsive sections, plus `/design-system/dashboard-preview` and `/design-system/admin-preview` with working sub-routes and page transitions. It uses demo fixtures only, is `noindex`, and returns **404 in production unless `ENABLE_DESIGN_SYSTEM=true`** (checked server-side per request).

### Changed — Web

- Auth form controls (`FormField`, `PasswordField`, `FormAlert`, `SubmitButton`) now wrap the design-system primitives. Their API is unchanged, and `name = id` is preserved for FormData. The auth card title is now the page `<h1>`. The signed-in card uses `Badge` and `Button loading`. No auth logic changed.
- The foundation home page shows "Phase 04" and links to the showcase when it is enabled.

### Added — Tests and tooling

- `apps/web/tests`: 46 tests (helpers + server-rendered component contracts, including a Phase 03 auth-field regression). Script: `npm run test -w @asra/web`. `tsx` was declared as a web devDependency (the version was already in the lockfile). A CI step "Web component tests" was added.

### Fixed

- `Toaster` returned a new array from `getServerSnapshot` on every call, which triggers React's "getServerSnapshot should be cached" warning in development. It now returns a stable constant.

### Documentation

- New [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). Updated ARCHITECTURE (§4.1, ADR-016–020), REQUIREMENTS (REQ-PUB-016/020/021, REQ-SCL-002), CLIENT-CLARIFICATIONS (V-01–V-06 updated; new B-07 Hindi course, V-09 time zone), README and `.env.example` (`ENABLE_DESIGN_SYSTEM`).

### Dependencies

- None added at runtime.

---

## [0.3.0] — 2026-10-13

**Phase:** 03 — Authentication & RBAC
**Status:** Implemented (uncommitted, pending review)

### Added — API

- Auth endpoints under `/api/v1/auth`: `register`, `login`, `refresh`, `logout`, `logout-all`, `me`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`.
- Passwords hashed with **Argon2id** (`argon2`), with timing-equalised login failures and transparent rehash on parameter changes.
- 15-minute **JWT access tokens** (`jose`, HS256) with issuer, audience, algorithm and expiry verified. Claims are limited to `sub` and `sid`.
- **Rotating refresh sessions:**
  - the refresh token is a 256-bit opaque value in an HttpOnly, SameSite=Strict cookie scoped to `/api/v1/auth`;
  - only its SHA-256 hash is stored;
  - rotation uses an atomic compare-and-swap;
  - reuse of a rotated token revokes the session;
  - the session lifetime is an absolute 30 days.
- `authenticate` middleware loads session, user, roles and permissions in one query per request. Logout, reset, suspension and role changes take effect immediately.
- `requireRole` / `requirePermission` middleware (401 vs 403) and an `accessPolicy` service for resource ownership (faculty ↔ assigned course).
- Single-use, hashed email-verification and password-reset tokens, delivered in the URL fragment.
  - A password reset revokes all of the user's sessions.
  - Email verification is required before sign-in.
- Anti-enumeration: registration, forgot-password and resend-verification return identical responses for existing and unknown emails.
- Provider-neutral email service: a `console` transport (development only) and a `memory` transport (tests). The API refuses to start in production until a provider exists (Q-01).
- Rate limits per endpoint (`express-rate-limit`), backed by Redis (`rate-limit-redis`) with an in-memory fallback and re-initialisation on reconnect.
- CSRF defence: an `Origin` / `Sec-Fetch-Site` allow-list on auth routes, layered on the SameSite cookie. CORS allow-list headers updated. `Cache-Control: no-store` on auth responses.
- Log redaction for passwords, tokens, cookies and auth headers.
- Operator CLI `npm run auth:create-user` to provision FACULTY, ADMIN and SUPER_ADMIN accounts. There is no public route for privileged roles.

### Added — Database

- Migration `20261013045953_auth_sessions_and_tokens`:
  - tables `auth_sessions` and `one_time_tokens`;
  - enums `session_revocation_reason` and `one_time_token_purpose`;
  - unique token-hash indexes;
  - CHECK constraints: SHA-256 format only, consistent revocation, expiry after creation.

### Added — Web

- `/login`, `/register`, `/forgot-password`, `/reset-password` and `/verify-email` in an `(auth)` route group, built with the ASRA green/gold card design and shadcn-style `Input` and `Label`.
- `AuthProvider`:
  - keeps the access token in memory only;
  - restores the session via refresh on load;
  - refreshes before expiry, single-flight;
  - retries once after a 401.
- The shared `apiRequest` client (`credentials: 'include'`) with a typed `ApiClientError`.
- Forms reuse the API's Zod schemas from `@asra/validation`.

### Added — Shared packages

- `@asra/types`: `AuthUser`, `AuthSessionData`; error codes `EMAIL_NOT_VERIFIED` and `ACCOUNT_DISABLED`.
- `@asra/validation`: `registerSchema`, `loginSchema`, `passwordSchema` (10–128 characters, no composition rules), `emailOnlySchema`, `resetPasswordSchema`, `verifyEmailSchema`.

### Added — Tests and docs

- 59 new automated tests (99 in total): registration, login, refresh rotation and reuse, concurrent refresh and reset, logout, recovery, verification, 401/403 matrix, ownership policy, CORS, CSRF, Helmet, log redaction, rate limits, and the Redis store fallback.
- New `docs/AUTHENTICATION.md`. Updated ARCHITECTURE, SRS, REQUIREMENTS, DATABASE, CLIENT-CLARIFICATIONS (new D-06, S-05, S-06; Q-01 now blocks production) and README.

### Changed

- `JWT_SECRET` is now **required in every environment**.
- New env vars: `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL_MINUTES`, `REFRESH_SESSION_TTL_DAYS`, `PASSWORD_RESET_TTL_MINUTES`, `EMAIL_VERIFICATION_TTL_HOURS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_DOMAIN`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `RATE_LIMIT_STORE`.
- ADR-005 now uses Argon2id instead of bcrypt; no bcrypt hashes existed, so nothing needs migrating.
- Root scripts now include `db:migrate:create`, `db:migrate:status`, `db:reset`, `test` and `auth:create-user`.

### Fixed

- Root `npm run db:migrate -- --name x` now forwards arguments to Prisma. Previously npm swallowed `--name`, so Prisma prompted interactively.

---

## [0.2.0] — 2026-10-13

**Phase:** 02 — Database & Backend Core
**Status:** Implemented (uncommitted, pending review)

### Added — Database

- Prisma schema with the initial LMS domain: `User`, `Role`, `Permission`, `StudentProfile`, `FacultyProfile`, `AcademicLevel`, `Class`, `Stream`, `Subject`, `CourseCategory`, `Course`, `CourseInstructor`, `Module`, `Chapter`, `Lesson` and `Resource`.
- Two additional join models, `UserRole` and `RolePermission`. A user can hold multiple roles; one role per user is pending S-04.
- Conventions: PostgreSQL-generated UUID keys, snake_case tables and columns, `timestamptz(3)` UTC timestamps, explicit `RESTRICT`/`CASCADE` rules, unique positions within each curriculum parent.
- Initial migration `20261013042559_init_database_core`, including hand-written CHECK constraints: normalised email, key and slug formats, non-negative numbers, `published_at` required when published, and exactly one location per resource.
- Idempotent, transactional seed for the 4 system roles and 11 permissions. It seeds no user accounts and no academic catalogue.
- New `docs/DATABASE.md`: entity relationships, conventions, constraints, migration, seed and reset workflow, local vs. Neon setup.

### Added — Backend

- `src/database/`: shared Prisma client and pool settings, `pingDatabase`, graceful disconnect, the `DbClient` type and seed modules.
- Safe Prisma error mapping (`database/errors.ts`): 409 for unique or relation conflicts, 404 for missing records, 422 for CHECK violations and over-long values, 503 when the database is unreachable. SQL, constraint names and row values are never exposed.
- `validateRequest` Zod middleware and common validators (`id`, `slug`, pagination).
- Shared `PERMISSIONS` (`@asra/types`); `emailSchema`, `slugSchema`, `positionSchema` and `resourceInputSchema` (`@asra/validation`).
- `access-control.repository.ts`: the repository pattern, transaction-aware via `DbClient`.
- Startup database check; the API keeps running if it fails and readiness reports `database: "down"`.
- Root scripts `db:migrate:create`, `db:migrate:status`, `db:reset`. `db:migrate`, `db:migrate:create` and `db:reset` are guarded and refuse non-local hosts and `NODE_ENV=production`.
- Automated tests (40) with Node's built-in test runner and `tsx`, against a separate local `*_test` database. No new dependencies.

### Changed

- Moved `src/lib/prisma.ts` to `src/database/prisma.ts`.
- Readiness probes are injectable, for testing.
- New env vars `DATABASE_POOL_MAX` and `TEST_DATABASE_URL` (both optional). `DIRECT_DATABASE_URL` is validated when set.

### Fixed

- Empty `JWT_SECRET=` (as shipped in `.env.example`) no longer fails API startup in development.

### Notes

- Migration and tests were verified against local Docker PostgreSQL 17. **Neon connectivity was not tested**: no credentials were available. See `docs/DATABASE.md` §9.

---

## [0.1.1] — 2026-10-12

**Phase:** 01 — Project Foundation (brand update)
**Status:** Requirement Freeze / Foundation

### Added

- Added the official ASRA Academy logo supplied by the client. The master file is in `docs/brand/`; web copies are in `apps/web/public/brand/`.
- Generated favicon and icons from the logo's crest:
  - `favicon.ico` (16/32/48 px), `icon.png` and `apple-icon.png`, on an ivory tile so they stay visible on dark browser tabs.
  - Web app manifest (`manifest.ts`) with standard and maskable icons.
  - A 1200×630 Open Graph / Twitter share image (`public/brand/og-image.png`) with alt text.
- Added `apps/web/src/config/site.ts`, a single source for name, tagline, founding statement, contact email and logo paths.
- Added `docs/brand/README.md`, covering asset inventory, usage rules and colour contrast.

### Changed

- Theme tokens now use colours sampled from the logo instead of approximations.
- Added `asra-gold-800` (`#8a5a0b`) for gold text, because the logo gold is only 2.9:1 on ivory.
- Site metadata now includes the tagline, Open Graph and Twitter cards, and theme colour `#012114`.
- The foundation page and 404 page now show the logo or emblem. The footer shows "Founded by students of AMU" and asraacademy1@gmail.com.
- Updated the client clarifications:
  - V-01 is partially confirmed: the logo PNG was received; a vector file and a reversed variant are still needed.
  - V-08 (contact email) and Q-03 (enquiry recipient) are now confirmed.
  - Added V-07 for the tagline and founding-statement wording.

---

## [0.1.0] — 2026-10-12

**Phase:** 00 — Requirement Freeze & Project Preparation · 01 — Project Foundation & Architecture
**Status:** Requirement Freeze / Foundation

### Added — Documentation (Phase 00)

- Wrote the initial project documentation from the client Project Development Order (Section 7, the commercial proposal, is excluded):
  - `docs/PRD.md`: product requirements, educational programs, capabilities, design direction.
  - `docs/SRS.md`: software requirements, prioritised MUST / SHOULD / FUTURE and tagged Client / Technical Recommendation / Pending.
  - `docs/ARCHITECTURE.md`: modular monolith architecture, boundaries, provider abstractions, decision log.
  - `docs/REQUIREMENTS.md`: requirements matrix with internal IDs.
  - `docs/CLIENT-CLARIFICATIONS.md`: open client questions in categories A–X.
  - `docs/CHANGELOG.md`: this file.
- Moved earlier internal working notes into `docs/reference/`. They are not authoritative.

### Added — Foundation (Phase 01)

- Locked the technology stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Express, PostgreSQL (Neon in production), Prisma, Zod, JWT/bcrypt (Phase 03), Redis + BullMQ (later phases).
- Set up an npm workspaces monorepo with `apps/web`, `apps/api` and `packages/{types,validation,config}`.
- `apps/web` covers:
  - Next.js 16 App Router with strict TypeScript and Tailwind CSS 4.
  - The shadcn/ui foundation (`components.json`, `cn` utility, Button and Card).
  - Provisional ASRA green and gold design tokens.
  - Validated public env.
  - A placeholder foundation page that shows live API status, plus a 404 page.
- `apps/api` covers:
  - Express 5 with a layered structure.
  - `GET /api/v1/health` and `GET /api/v1/health/ready`.
  - A central error handler, a 404 handler, Helmet, a CORS allow-list and pino request logging with `X-Request-Id`.
  - Zod environment validation and graceful shutdown.
- Configured Prisma 7: a foundation schema with no domain models, `prisma.config.ts`, the PostgreSQL driver adapter and a connectivity-only seed.
- Added a script that checks PostgreSQL and Redis connectivity (`npm run check:services`).
- Added Docker Compose for local development:
  - PostgreSQL 17 and Redis 7.4.
  - Health checks and named persistent volumes.
  - Configurable ports and a Redis config with AOF and `noeviction`.
- Added `.env.example`, which documents each variable for LOCAL, DEVELOPMENT and PRODUCTION.
- Set up code quality tooling: strict TypeScript, ESLint 9 (flat config), Prettier, EditorConfig, and Husky + lint-staged as a pre-commit hook.
- Added GitHub Actions CI covering install, format check, lint, Prisma validate and generate, typecheck, build and compose validation. CI needs no secrets.
- Documented the Git workflow: `feature/*` → `develop` → `main`.

### Notes

- No business features are implemented yet: no auth, LMS domain, payments, live classes or notifications.
- Docker PostgreSQL is for local development only. Production uses Neon.
