# ASRA Academy — Student LMS (PHASE 07)

The student learning experience: dashboard, enrolment and course access, course player, persistent progress, study materials, profile and records. Builds on Phase 03 (auth/RBAC) and Phase 06 (Course → Module → Chapter → Lesson → Resource).

Open decisions are listed in [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) §AA. Nothing here simulates payments, results, certificates, live classes or file storage.

---

## 1. What exists and what does not

| Capability                 | Status in Phase 07                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enrolment / course access  | **Implemented.** `Enrollment` model; free self-enrolment; manual enrolment by administrators; access policy on every content endpoint                                                    |
| Course player              | **Implemented.** Curriculum sidebar, lesson content by type, previous/next, resume                                                                                                       |
| Lesson progress            | **Implemented.** `LessonProgress` model; mark complete / not complete; course percentage; last activity; learning history                                                                |
| Video progress             | **Implemented** for directly playable files (server-bounded heartbeats). YouTube/Vimeo embeds and other links have **no telemetry** (§5)                                                 |
| Study materials            | **Implemented** for external HTTPS links. Stored files are shown as unavailable: no storage provider exists (R-01, G-01)                                                                 |
| Quizzes / assignments      | QUIZ lessons: instructions only (PHASE 09). ASSIGNMENT lessons: **online submission, faculty grading and released results since PHASE 08** ([FACULTY-PORTAL.md](./FACULTY-PORTAL.md) §5) |
| Examinations, results      | Exams **not available** (PHASE 09). Released **assignment** results are listed on `/student/results` (PHASE 08)                                                                          |
| Live classes               | Classes **scheduled by faculty** are listed (PHASE 08; no provider, F-01). Recorded lectures = video lessons                                                                             |
| Payments / payment history | **Not available** (PHASE 10, M-01/M-02 pending). No payment record is ever created or implied                                                                                            |
| Certificates               | **Not issued** (PHASE 13, L-01/L-02 pending). Completed courses are listed as "No certificate issued"                                                                                    |

Unavailable capabilities are reported by the API (`GET /student/features`, also in the dashboard) with the message the portal displays, so the UI never invents records.

## 2. Enrolment and access rules

### 2.1 Access policy (`accessPolicy.assertCanViewCourseContent`)

A student may read a course's protected content (curriculum with lesson ids, lessons, resources, progress) only when **all** hold:

1. authenticated, role `STUDENT` (router) and permission `content.view_enrolled`;
2. the course is `PUBLISHED` — publication alone never grants access;
3. an `Enrollment` for **this user** and course with status `ACTIVE`;
4. the lesson itself is `PUBLISHED` (drafts are 404).

The course is always resolved from the database (`lesson → chapter → module → course`), never from the URL or body. Responses: course not published, or PRIVATE without enrolment → **404**; visible course without enrolment → **403**. `visibility` only governs the public website: enrolled students reach a PRIVATE course.

Course **overview** (`GET /student/courses/:id`) is readable for any published PUBLIC/UNLISTED course, but shows the outline (titles) only; lesson ids and progress need an enrolment.

### 2.2 Free self-enrolment

`POST /student/courses/:id/enroll` succeeds only for a PUBLISHED, non-PRIVATE course whose `priceMinor` is **exactly 0**. A missing price means "not configured", never "free" (B-04). A 100 % discount does not make a course free (no final price is computed until PHASE 10, Z-02). No request body is read — a client cannot send a price or payment status.

- Already active → 200 "already enrolled"; no duplicate row (unique `(user_id, course_id)`, plus a course row lock).
- Cancelled enrolment → 409; the student cannot reopen what the academy cancelled (D-04).
- Paid / unpriced → 403 "arranged by the academy".

### 2.3 Manual enrolment by administrators (`enrollments.manage`)

Admin portal → Courses → a course → **Enrolments** tab, or the API (§6.2). Enrols an existing STUDENT account by email, in DRAFT or PUBLISHED courses (access starts when published; ARCHIVED refused). Re-enrolling a cancelled student reactivates the same row (progress kept). Cancelling revokes access immediately; progress is kept. Each row records `source = ADMIN` and the administrator (`enrolled_by_id`).

This is the only way into paid courses until verified payments exist (PHASE 10). It is **not** a payment and creates no payment record (M-07 pending).

### 2.4 States

`EnrollmentStatus`: `ACTIVE` (grants access) and `CANCELLED`. Completion is a timestamp (`enrollments.completed_at`), not a status, because lessons can be added after a student finishes. `EnrollmentSource`: `FREE`, `ADMIN` (PHASE 10 adds `PAYMENT`). Course deletion is refused while any enrolment exists (FK `RESTRICT` + a clear 409).

## 3. Student portal routes

All under the `(student)` route group with `AuthProvider` + `StudentShell` (session gate, redirect to `/login?next=…`, non-students see a "not a student account" card). Pages are `noindex`. The UI gate is not the security boundary; the API is.

| Route                                                     | Content                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/student` → `/student/dashboard`                         | Summary stats, Continue learning, My courses, classes/assessments tiles, results & completed courses |
| `/student/courses`                                        | Enrolled courses (paginated); **Find courses** tab (`?tab=find`) with search and free enrolment      |
| `/student/courses/[courseId]`                             | Overview, access state (enrolled / free / contact academy), curriculum or outline                    |
| `/student/learn/[courseId]`                               | Player; `?lesson=<id>`; without it, resumes at the API's resume lesson                               |
| `/student/classes`                                        | Live classes (unavailable) + recorded lectures (video lessons)                                       |
| `/student/assignments`, `/student/quizzes`                | ASSIGNMENT / QUIZ lessons of enrolled courses + the engine-not-available note                        |
| `/student/exams`, `/student/results`, `/student/payments` | Unavailable states with the API message                                                              |
| `/student/progress`                                       | Every active course with its progress and last activity                                              |
| `/student/certificates`                                   | Completed courses ("No certificate issued")                                                          |
| `/student/profile`                                        | Personal info (name, phone editable), academic info (read-only), enrolment records, record links     |
| `/student/history`                                        | Lessons opened, newest first                                                                         |

After sign-in, students without a `?next=` target go to `/student/dashboard`; the signed-in card on `/login` links there.

### 3.1 Journey

Register → verify email → sign in → dashboard → Find courses → enrol (free) or be enrolled by the academy → open course → lesson (video / PDF / link / text) → open study material → **Mark lesson complete** → dashboard and player show the new percentage → later, **Continue learning** reopens the last lesson.

## 4. Progress calculation

- **Eligible lessons**: PUBLISHED lessons of the course whose type is VIDEO, PDF, DOCUMENT, LINK or TEXT. QUIZ and ASSIGNMENT lessons are excluded until the assessment engine can complete them (A-07).
- **Completed**: eligible lessons with `lesson_progress.completed_at` set for the student. Duplicates count once; completions of lessons that are no longer eligible (unpublished/deleted) are ignored.
- **Percent**: `floor(completed × 100 / eligible)` — 100 only when all are complete; `null` (shown as "No lessons to complete yet") when there are no eligible lessons. Derived on every read from authoritative rows; no stored aggregate to drift.
- **Course completion**: the first time every eligible lesson is complete (checked on each completion), `enrollments.completed_at` is set. It is never cleared — reopening a lesson or adding lessons lowers the percentage but keeps the date. Reads never write.
- **Mark complete** is an explicit, idempotent student action (first completion time kept, one row per student and lesson). **Mark as not complete** clears it (accidental clicks); the course completion date stays.
- **Last activity / resume**: opening a lesson (`POST …/activity`, sent once per lesson view), a video heartbeat or a completion updates `enrollments.last_lesson_id` and `last_activity_at` in the same transaction as the progress row. Resume = last lesson if it is still published in the course, else the first published lesson. Page renders and list views never update activity.

Implementation: `apps/api/src/modules/student/progress.ts` (pure, unit-tested).

## 5. Video playback and telemetry

| Source (detected in `lib/student/learning.ts`)           | Player                                                  | Telemetry                        |
| -------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- |
| HTTPS file `.mp4/.webm/.ogg/.mov/.m4v` or `video/*` MIME | Native `<video>`, resumes at the saved position         | Yes                              |
| YouTube (`youtube-nocookie.com`), Vimeo (`dnt=1`)        | Provider embed (sandboxed iframe)                       | **No** — stated under the player |
| Anything else                                            | "Watch the video" link (new tab, `noopener noreferrer`) | No                               |

Heartbeats (`PUT /student/lessons/:id/progress`, body `{ positionSeconds, playedSeconds }`, strict):

- The player counts only small forward steps of the playhead (seeks/jumps are not played time) and sends a heartbeat every **15 s** while playing and on pause/end/leave — never per tick.
- The server credits `min(playedSeconds, seconds since the previous accepted heartbeat + 2 s)`; the first heartbeat of a session at most 30 s; at most 120 s per request. Parallel tabs or replayed requests cannot earn more than wall-clock time. The row is locked during the update.
- Watched time and position are capped at the lesson's `durationSeconds`. `video_completed_at` is set when credited time reaches **90 %** of it. **Without a configured duration, video completion is never claimed.**
- Video completion is informational ("You have watched this video"); it does not complete the lesson.

This is engagement telemetry, not proof of viewing. Signed/DRM delivery is pending G-01/G-02.

## 6. API

All responses use the standard envelope; all student routes send `Cache-Control: no-store`.

### 6.1 Student — `/api/v1/student` (Bearer token, role STUDENT)

| Method & path                            | Permission              | Notes                                                                                                 |
| ---------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /dashboard`                         | `content.view_enrolled` | Aggregated: stats, continue learning, first 6 courses, assessment counts, completed courses, features |
| `GET /features`                          | role only               | Availability + messages of deferred capabilities                                                      |
| `GET /courses?page&pageSize`             | `content.view_enrolled` | Entitled courses (ACTIVE + PUBLISHED) with progress and resume lesson                                 |
| `GET /enrollments?status&completed&page` | `content.view_enrolled` | The student's enrolment records, incl. cancelled                                                      |
| `GET /catalog?q&page`                    | `content.view_enrolled` | Published PUBLIC courses with `access` state                                                          |
| `POST /courses/:id/enroll`               | `content.view_enrolled` | Free self-enrolment (201 new, 200 already enrolled)                                                   |
| `GET /courses/:id`                       | `content.view_enrolled` | Overview; curriculum only when enrolled                                                               |
| `GET /courses/:id/curriculum`            | + enrolment             | Ordered published curriculum, completion per lesson, resume lesson id                                 |
| `GET /courses/:id/progress`              | + enrolment             | `CourseProgressDto`                                                                                   |
| `GET /lessons?contentType&courseId&page` | `content.view_enrolled` | Lessons of one type across enrolled courses (quizzes, assignments, recorded lectures)                 |
| `GET /lessons/:id`                       | + enrolment             | Player payload: content, resources, own progress, previous/next. No side effects                      |
| `GET /lessons/:id/resources`             | + enrolment             | Resource list with `access` (`external` URL or `unavailable`)                                         |
| `POST /lessons/:id/activity`             | + enrolment             | Records the view + resume point                                                                       |
| `POST /lessons/:id/complete`             | + enrolment             | Idempotent; 409 for QUIZ/ASSIGNMENT                                                                   |
| `DELETE /lessons/:id/complete`           | + enrolment             | Mark as not complete                                                                                  |
| `PUT /lessons/:id/progress`              | + enrolment             | Video heartbeat; VIDEO lessons only (400 otherwise)                                                   |
| `GET /history?page`                      | `content.view_enrolled` | Own lesson activity                                                                                   |
| `GET /profile`, `PATCH /profile`         | `profile.manage_own`    | PATCH accepts only `fullName`, `phone` (strict; 422 for anything else)                                |

Resource URLs are re-validated on the way out with `safeExternalUrlSchema` (HTTPS, public domain, no credentials); storage keys are never returned.

### 6.2 Admin — `/api/v1/admin` (`enrollments.manage`)

| Method & path                                | Notes                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /courses/:id/enrollments?q&status&page` | Students, status, source, enrolled by, progress                                |
| `POST /courses/:id/enrollments`              | `{ email }` of a STUDENT account; 409 if already active; reactivates cancelled |
| `POST /enrollments/:id/cancel`               | Revokes access; 409 if already cancelled                                       |

`enrollments.manage` is granted to ADMIN and SUPER_ADMIN (seeded; `npm run db:seed` adds it to existing databases).

## 7. Integration boundaries and configuration

- **Storage (R-01, G-01, H-02/H-03):** `CONFIGURED_STORAGE_PROVIDERS` is still empty. When a provider is added, `toStudentResource` (student.mappers.ts) is the single place to return a short-lived signed URL instead of `unavailable`; the access check before it is already in place.
- **Live classes (F-01…F-06):** no model or provider. PHASE 11 adds sessions behind a `LiveClassProvider` adapter; the dashboard tile and `/student/classes` switch from the feature message to real sessions.
- **Payments (M-01, M-02):** PHASE 10 adds Order/Payment and an enrolment source `PAYMENT` activated only by verified webhooks. `/student/payments` then lists real records.
- **Assessments (I, J, K):** PHASE 09 replaces the QUIZ/ASSIGNMENT placeholders; they then join the progress definition if the client confirms A-07.
- **Certificates (L-01, L-02):** PHASE 13 can use `enrollments.completed_at` as an eligibility input.
- **Time zone (V-09):** all dates shown in `Asia/Kolkata`.

No new environment variables. Local setup is unchanged: `npm run docker:up`, `npm run db:migrate:deploy`, `npm run db:seed`, `npm run dev`.

## 8. Database

Migration `20261016083843_phase07_student_lms` (additive; no existing data changed): enums `enrollment_status`, `enrollment_source`; tables `enrollments`, `lesson_progress`; four CHECK constraints. Details: [DATABASE.md](./DATABASE.md) §1, §4.2.3.

## 9. Tests and verification

| Suite                                   | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/tests/student-lms.test.ts`    | 401/403 on every area; staff vs student portals; free/paid/unpriced/private/unpublished access; no duplicate enrolments; forged payment body ignored; admin enrol/cancel/reactivate; course deletion guard; curriculum order without drafts; navigation boundaries; resource URL safety; progress idempotency, percentage, course completion, reopen; activity & resume fallback; per-student privacy; video heartbeat bounds; profile over-posting |
| `apps/api/tests/progress-rules.test.ts` | Percentage edge cases (no lessons, duplicates, floor), excluded types, heartbeat credit bounds, seek, caps, 90 % threshold, clock skew                                                                                                                                                                                                                                                                                                              |
| `apps/web/tests/student-lms.test.tsx`   | Video source detection (incl. unsafe URLs), playback tracker, formatting, navigation coverage, curriculum/outline markup, lesson text escaping, safe links, unavailable states, course card                                                                                                                                                                                                                                                         |

Commands: `npm test` (API, needs Docker PostgreSQL) · `npm test -w @asra/web` · `npm run typecheck` · `npm run lint` · `npm run build`.

The full acceptance journey (register → verify → login → dashboard → enrol → curriculum → video heartbeat → PDF → complete → persisted → dashboard progress → resume → profile/records → unauthorized checks → admin enrolment into a paid course) was also run over HTTP against a running API and the production web build. Interactive browser behaviour (dialogs, video element events) was not automated.
