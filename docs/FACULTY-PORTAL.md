# ASRA Academy — Faculty Portal (PHASE 08)

The faculty workspace: assigned courses, curriculum and resources, students and their progress, assignments → submissions → marks and feedback → released results, live-class scheduling, course performance and the faculty profile. Builds on Phase 03 (auth/RBAC), Phase 06 (Course → Module → Chapter → Lesson → Resource) and Phase 07 (enrolments and progress).

Open decisions are listed in [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) §AB. Nothing here simulates a meeting provider, file upload, quiz attempt, exam or grade.

---

## 1. What exists and what does not

| Capability                         | Status in Phase 08                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course-scoped faculty access       | **Implemented.** FACULTY role + permission + `CourseInstructor` assignment, checked on the server for every request (§2)                                         |
| Dashboard, courses, workspace      | **Implemented** from real records                                                                                                                                |
| Curriculum, lessons, resources     | **Implemented** — the SAME curriculum service and editor as the admin portal, limited to assigned courses                                                        |
| Video / PDF / documents            | **Links only** (validated `https://` references). No upload: no storage provider is configured (R-01, G-01). The upload control is not shown                     |
| Assignments, submissions, grading  | **Implemented.** Settings (max marks, due date), student text + optional link submission, review, marks, feedback, explicit result release, student results page |
| Live classes                       | **Scheduling implemented**, provider-neutral. Faculty may paste a meeting link they created themselves; no meeting is created through any provider API (F-01)    |
| Students & performance             | **Implemented** — teaching data only (no contact details), metrics defined in §7                                                                                 |
| Faculty profile                    | **Implemented** — self-service fields only; allocation is read-only                                                                                              |
| Quizzes                            | **Not available** (PHASE 09). QUIZ lessons (instructions) are listed and edited through the curriculum; no questions, attempts or scoring are simulated          |
| Examinations                       | **Not available** (PHASE 09). Honest unavailable page; no model exists                                                                                           |
| Notifications (new class, results) | **Not sent** (PHASE 11)                                                                                                                                          |

## 2. Authorization

### 2.1 Layers

1. **Router** (`/api/v1/faculty/*`): `authenticate` → `requireRole('FACULTY')` → `Cache-Control: no-store`. A faculty profile alone grants nothing; an ADMIN without the FACULTY role gets 403 here, and a FACULTY user gets 403 on `/api/v1/admin/*`.
2. **Permission per route** (seeded for FACULTY):

   | Permission                     | Covers                                                          |
   | ------------------------------ | --------------------------------------------------------------- |
   | `content.manage_assigned`      | Dashboard, courses, curriculum, lessons, resources, assignments |
   | `students.view_assigned`       | Students list, course performance                               |
   | `submissions.grade_assigned`   | Submission list/detail, grading, result release                 |
   | `live_classes.manage_assigned` | Live-class list, schedule, edit, cancel                         |
   | `profile.manage_own`           | Own profile                                                     |

3. **Course assignment** in the service, for the course resolved **from the database** (submission → assignment → lesson → chapter → module → course; never from the URL or body):
   - curriculum: `accessPolicy.assertCanManageCourseContent` (unchanged Phase 06 hook — `content.manage` for admins, `content.manage_assigned` + assignment for faculty);
   - everything else: `accessPolicy.assertTeachesCourse(auth, courseId, permission)` — permission **and** a `CourseInstructor` row for this user, with no "any course" bypass.
   - list endpoints start from `accessPolicy.taughtCourseIds()`; a `courseId` filter outside it is 403.

Unknown ids are 404, a known course that is not the caller's is 403 (course ids are not secret, as in Phase 06). Removing a faculty member from a course in the admin portal revokes access on the next request.

### 2.2 What faculty cannot do (no route exists, or 403)

Change roles or permissions; assign themselves or others to courses; publish, unpublish, archive or delete courses; edit course details, prices or visibility; enrol or cancel students; see students' email, phone or payment data; see other faculty members' courses, submissions or classes; set their own designation, employee code or public visibility.

### 2.3 Publication

- **Courses** are published by administrators only (Z-11 assumption unchanged).
- **Lessons**: faculty can set a lesson to Draft/Published in their assigned courses — the current C-03 assumption ("faculty publish directly; admins can unpublish"). A lesson is visible to students only when the lesson AND the course are published. Saving content never publishes the course.
- The published-course guard still applies: a change that would leave a live course ineligible (e.g. unpublishing its last lesson) is refused with 422.

## 3. Portal routes (web)

Route group `(faculty)` with `AuthProvider` + `FacultyShell` (session gate, redirect to `/login?next=…`, non-faculty accounts see a "not a faculty account" card). All pages are `noindex`. Faculty without a `?next=` target go to `/faculty/dashboard` after sign-in. `/faculty` itself remains the **public** faculty directory (Phase 05); the portal lives under its sub-paths.

| Route                                 | Content                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/faculty/dashboard`                  | Counts, assigned courses, oldest submissions awaiting review, upcoming classes, shortcuts              |
| `/faculty/courses`                    | Assigned courses (search, pagination)                                                                  |
| `/faculty/courses/[courseId]?tab=…`   | Workspace tabs: overview, curriculum (shared editor), students, assignments, live classes, performance |
| `/faculty/content`                    | Courses with a direct "Manage curriculum" link                                                         |
| `/faculty/students`                   | Enrolled students of all assigned courses (filter by course, search by name)                           |
| `/faculty/classes`                    | Upcoming/past classes, schedule, edit, cancel                                                          |
| `/faculty/assignments`                | Assignment lessons, "New assignment" dialog                                                            |
| `/faculty/assignments/[lessonId]`     | Instructions, submission settings, submissions of this assignment                                      |
| `/faculty/submissions`                | Review queue: filter by course and review state, oldest/newest first                                   |
| `/faculty/submissions/[submissionId]` | Original work, marks + feedback form, release (with confirmation)                                      |
| `/faculty/quizzes`, `/faculty/exams`  | QUIZ lessons + engine-not-available message; exams unavailable                                         |
| `/faculty/performance`                | Course picker → metrics (§7) + per-student table                                                       |
| `/faculty/profile`                    | Editable self-service fields; academy-managed fields and allocation read-only                          |

Student portal changes: assignment lessons show a **Your submission** panel; `/student/results` lists released results; `/student/classes` lists scheduled classes of enrolled courses.

## 4. API

Standard envelope; lists are `{ items, pagination }`; bodies are Zod `.strict()` (unknown keys → 422, preventing over-posting of reviewers, statuses, release times or scores).

### 4.1 Faculty — `/api/v1/faculty`

| Method & path                                         | Permission                     | Notes                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard`                                      | `content.manage_assigned`      | Aggregated, assigned courses only                                                                                                         |
| `GET /features`                                       | role only                      | Provider / upload / quiz / exam availability messages                                                                                     |
| `GET /courses?q&page`                                 | `content.manage_assigned`      | Course cards with counts                                                                                                                  |
| `GET /courses/:id`                                    | `content.manage_assigned`      | Workspace overview incl. colleagues (name, designation, primary)                                                                          |
| `GET /courses/:id/performance`                        | `students.view_assigned`       | §7                                                                                                                                        |
| `GET /students?courseId&q&page`                       | `students.view_assigned`       | One row per ACTIVE enrolment; no contact details                                                                                          |
| `GET /lessons?contentType&courseId`                   | `content.manage_assigned`      | Lessons of one type in assigned courses (any status), e.g. QUIZ                                                                           |
| Curriculum routes                                     | `content.manage_assigned`      | Identical to `/admin` (COURSE-MANAGEMENT.md §6.1), e.g. `POST /chapters/:id/lessons`, `PATCH /lessons/:id`, `POST /lessons/:id/resources` |
| `GET /assignments?courseId&page`                      | `content.manage_assigned`      | ASSIGNMENT lessons with settings (or `null`) and counts                                                                                   |
| `GET /assignments/:lessonId`                          | `content.manage_assigned`      | Detail                                                                                                                                    |
| `POST /chapters/:id/assignments`                      | `content.manage_assigned`      | Lesson + settings in one transaction                                                                                                      |
| `PUT /lessons/:id/assignment`                         | `content.manage_assigned`      | Create/update settings `{ maxMarks, dueAt? }`                                                                                             |
| `GET /submissions?courseId&lessonId&status&sort&page` | `submissions.grade_assigned`   | `status`: SUBMITTED · GRADED (unreleased) · RELEASED                                                                                      |
| `GET /submissions/:id`                                | `submissions.grade_assigned`   | Original text and link                                                                                                                    |
| `PUT /submissions/:id/grade`                          | `submissions.grade_assigned`   | `{ marksAwarded, feedback?, expectedUpdatedAt? }`                                                                                         |
| `POST /submissions/:id/release`                       | `submissions.grade_assigned`   | Idempotent                                                                                                                                |
| `GET /live-classes?courseId&when&page`                | `live_classes.manage_assigned` | `when`: upcoming (not ended) · past                                                                                                       |
| `POST /courses/:id/live-classes`                      | `live_classes.manage_assigned` | `{ title, description?, startsAt, durationMinutes, joinUrl? }`                                                                            |
| `PATCH /live-classes/:id`                             | `live_classes.manage_assigned` | Not after it ended or was cancelled (409)                                                                                                 |
| `POST /live-classes/:id/cancel`                       | `live_classes.manage_assigned` | Idempotent; not after it ended                                                                                                            |
| `GET /profile`, `PATCH /profile`                      | `profile.manage_own`           | PATCH: `fullName, phone, bio, qualifications, specialization, experienceYears` only                                                       |

### 4.2 Student additions — `/api/v1/student` (enrolment policy of STUDENT-LMS.md §2 applies)

| Method & path                  | Notes                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET /lessons/:id/assignment`  | Settings, own submission; marks/feedback only once released                              |
| `POST /lessons/:id/submission` | `{ body, attachmentUrl? }` — once; 409 if already submitted or submission not open       |
| `GET /results?page`            | Own released results only                                                                |
| `GET /live-classes?when&page`  | Classes of accessible courses; join link only until the class ends, never when cancelled |

`GET /student/features` now reports `assignmentSubmissions`, `results` and `liveClasses` as available.

## 5. Assignments, grading and results

```
ASSIGNMENT lesson (title, instructions = body, attachments = resources, DRAFT/PUBLISHED)   ← curriculum (Phase 06)
  └─ Assignment (maxMarks 1–1000, dueAt?)                                                  ← submission settings
       └─ AssignmentSubmission (body, link?, submittedAt)                                  ← one per student
            → faculty review → marksAwarded + feedback (GRADED, gradedBy, gradedAt)
            → release (resultReleasedAt) → visible to the student
```

- **No parallel content system.** An assignment is an ASSIGNMENT lesson; admin-created ASSIGNMENT lessons get online submission when faculty add settings.
- **Open for submission** = lesson PUBLISHED + course PUBLISHED + settings exist + the student's ACTIVE enrolment.
- **Submission** (I-01 pending): plain text (≤ 20,000 characters) and an optional `https://` link; files need storage (R-01). One per student; immutable afterwards (I-02 pending — no resubmission is invented). After the due date it is accepted and flagged **late**; no penalty (I-02).
- **Marks** (I-03 pending): whole numbers 0…maxMarks, validated on the server inside a transaction that row-locks the submission. Re-grading is allowed until release; `expectedUpdatedAt` turns a concurrent review into 409. `maxMarks` cannot change once any submission is graded.
- **Release** (K-04 pending): separate, explicit action; only a GRADED submission can be released; released results are final (grading → 409). Before release the student sees only "submitted" — not even that it was graded.
- **Protection of student work:** deleting an assignment lesson, or changing its type, is refused (409) while submissions exist; FK `assignment_submissions → assignments` is RESTRICT as a second line of defence. Editing title, instructions or the due date never touches submissions.

## 6. Live classes

- Stored in UTC; requests carry an explicit offset. The portal enters and shows **IST** (V-09) regardless of the browser's time zone (`istInputToIso`).
- Rules: start in the future and within a year; 15–480 minutes; course not archived. Overlaps are not checked (no rule defined; F-03).
- **Upcoming** = start + duration in the future; **past** = ended. The platform never says a class is "live" — no provider confirms it.
- **Links**: optional `https://` meeting link entered by faculty (`provider = 'manual'`). Returned only to the course's faculty and to enrolled students (until the class ends), never for a cancelled class, never by public endpoints. With no link, students see the time only.
- **Provider integration (F-01/F-02/F-06):** none configured. `LiveClassSession.provider` + `joinUrl` are the integration point: a `LiveClassProvider` adapter (ARCHITECTURE §8) can create meetings and fill them on schedule. Not built or tested here.

## 7. Performance metric definitions

All metrics are computed on request from authoritative rows, for one course the caller teaches, over its **ACTIVE** enrolments.

| Metric                   | Definition                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Enrolled students        | ACTIVE enrolments in the course                                                                                               |
| Countable lessons        | PUBLISHED lessons of type VIDEO, PDF, DOCUMENT, LINK, TEXT (STUDENT-LMS.md §4)                                                |
| Student progress         | `floor(completed countable lessons × 100 / countable lessons)`; `null` when there are none                                    |
| Average progress         | Mean of the students' percentages (floored); `null` with no students or no countable lessons                                  |
| Distribution             | Students per bucket 0 · 1–24 · 25–49 · 50–74 · 75–99 · 100 (and "none" when nothing is countable)                             |
| Completed                | Enrolments with `completed_at` set                                                                                            |
| Active in last 7 days    | `last_activity_at` within 7 days                                                                                              |
| Published assignments    | Assignment settings whose lesson is PUBLISHED                                                                                 |
| Submission rate          | Submissions of enrolled students to published assignments ÷ (published assignments × enrolled students), floored; `null` if 0 |
| Awaiting review / graded | SUBMITTED / GRADED-not-released submissions in the course                                                                     |
| Released score           | Σ released marks ÷ Σ their maxMarks, floored; `null` without released results                                                 |

Per-student rows: progress, published assignments, submitted, graded, released and released score. Queries are batched (a fixed number per page — no N+1). Not shown, because no data supports them: attendance, rankings, predictions, risk scores, quiz/exam scores, trends over time.

## 8. Integration boundaries and configuration

- **Storage (R-01, G-01, H-01):** unchanged — `CONFIGURED_STORAGE_PROVIDERS` is empty, stored-object references are refused with 422, and the dashboard says uploads are unavailable. Adding a provider: the Phase 06/07 steps (adapter, upload/signed-URL flow) plus an optional file field on submissions.
- **Live-class provider (F-01):** §6.
- **Assessment engine (PHASE 09):** quizzes and exams; QUIZ lessons stay instruction placeholders until then.
- **Notifications (PHASE 11):** none are sent for new classes, submissions or released results.

No new environment variables.

## 9. Database

Migration `20261016102329_phase08_faculty_portal` (additive; no existing data changed): enums `submission_status`, `live_class_status`; tables `assignments`, `assignment_submissions`, `live_class_sessions`; nine CHECK constraints (DATABASE.md §4.2.4). Seed: three new permissions for FACULTY (and SUPER_ADMIN).

After pulling: `npm run db:migrate:deploy` (or `npm run db:migrate` locally) and `npm run db:seed` (grants the new permissions to existing databases).

## 10. Tests and verification

| Suite                                    | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/tests/faculty-portal.test.ts`  | 401/403 for anonymous/student/admin; assigned-course scoping; IDOR on course/lesson/resource/submission/class ids; no self-assignment, publication or enrolment; revocation by reassignment; per-route permissions; lesson/resource CRUD, unsafe URLs, storage refusal, publication guard; full assignment → submission → grade → release workflow with mark bounds, over-posting, stale edits, release-before-grade, hidden unreleased grades, final results, per-student results; submission protection on delete/type change/max-marks change; late flag; settings for admin-created lessons; live-class validation, links scoped to enrolled students, public page leak check, cancel, past classes; dashboard/students/performance figures and empty-course nulls; profile over-posting |
| `apps/api/tests/student-lms.test.ts`     | Updated: `features` now lists exactly `assignmentSubmissions`, `liveClasses`, `results` as available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/tests/faculty-portal.test.tsx` | IST conversion, review/class states (no "live"), labels, navigation coverage, shared form schemas, course tile markup, session gate renders no portal content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Commands: `npm test` (API, Docker PostgreSQL) · `npm test -w @asra/web` · `npm run typecheck` · `npm run lint` · `npm run build`.

**Not verified in a browser.** The faculty UI was type-checked, linted, built and its pages served from the production build; dialogs, tabs, focus handling and responsive layout have not been clicked through in a real browser. The full workflow (assign → lesson → resource → assignment → student submission → grade → release → student result → performance) is covered over HTTP by the API suite.
