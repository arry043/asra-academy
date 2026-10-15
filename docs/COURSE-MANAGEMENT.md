# ASRA Academy — Academic & Course Management (PHASE 06)

| Field   | Value                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Version | 0.6.0                                                                                                                           |
| Status  | Phase 06 implemented — pending review                                                                                           |
| Scope   | Academic structure, courses, faculty assignment, curriculum, lesson content, publication                                        |
| Related | [DATABASE.md](./DATABASE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) §Z |

---

## 1. Academic model

```
AcademicLevel ──< Class                     CourseCategory
      │                                            │ category?
      └──< Stream                                  ▼
                 class? ─────────────────────▶ Course ◀── subject? ── Subject
                 stream? ────────────────────▶   │  >──< CourseInstructor >── FacultyProfile
                                                 └──< Module ──< Chapter ──< Lesson ──< Resource
```

The logical hierarchy **Class → Stream → Subject → Course → Module → Chapter → Lesson** is stored as follows (approved Phase 02 design, unchanged):

- **Classes and streams belong to an academic level** (e.g. "Classes 6–10"). An academic level must exist before a class can be created.
- **Subjects are independent.** "Mathematics for Class 10" is expressed by a **course** with `classId` + `subjectId` (SRS §1.3: a course is "a subject for a class"). There is no class–subject mapping table until the subject list per class/stream is confirmed (A-01, A-02). The PHASE 06 brief's "associate Mathematics with Class 10" is satisfied through the course; see Z-07.
- A **stream** on a course requires a class from the **same academic level** (validated).
- **Categories** group courses independently of the hierarchy. Category, class, stream and subject are all optional on a course; publication requires a category **or** class + subject (§3.2).
- **Faculty** are assigned through `CourseInstructor` (many-to-many, exactly one primary when any are assigned). Only `FacultyProfile` rows whose user holds the `FACULTY` role can be assigned; new assignments need an `ACTIVE` account.

### 1.1 Integrity and deletion rules

| Entity                                           | Delete                                                        | Instead                                                              |
| ------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Academic level                                   | Only without classes/streams                                  | Deactivate (`isActive = false`)                                      |
| Class / stream                                   | Only without courses/students                                 | Deactivate. Its level cannot change while in use                     |
| Subject / category                               | Only without courses                                          | Deactivate                                                           |
| Any catalogue row used by a **published** course | —                                                             | Cannot be deactivated (409) — unpublish or reassign the course first |
| Course                                           | Only `DRAFT`/`ARCHIVED` **without modules**                   | Archive                                                              |
| Module / chapter                                 | Only when empty (no chapters / lessons)                       | —                                                                    |
| Lesson                                           | Allowed; removes its resource **links** (no files are stored) | —                                                                    |

Names are unique per scope, compared case-insensitively ("class 10" = "Class 10"). Slugs are unique; a rename keeps the slug unless a new one is supplied. Inactive rows stay attached to existing courses but cannot be newly selected.

## 2. Course fields

| Field                               | Storage                                | Rules                                                                                                                                                                                                                   |
| ----------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                               | `title varchar(200)`                   | 3–200 characters                                                                                                                                                                                                        |
| Slug                                | `slug varchar(220)` unique             | Optional on input. Generated from the title (`class-10-mathematics`); collisions get `-2`, `-3`…; a custom slug that is taken → 409 on `slug`. Non-Latin titles fall back to `course`. Reserved: programme slugs (§5.2) |
| Summary                             | `summary varchar(500)`                 | Optional; shown on cards                                                                                                                                                                                                |
| Description                         | `description text`                     | Optional to save, **required to publish**. Plain text; blank lines separate paragraphs                                                                                                                                  |
| Thumbnail                           | `thumbnail_url varchar(2048)`          | Optional `https://` URL on a public domain. `thumbnail_key` (storage) stays reserved for R-01; at most one of the two (CHECK)                                                                                           |
| Category / Class / Stream / Subject | FKs (RESTRICT)                         | Optional; must exist and be active when newly linked; stream ⇒ class of the same level                                                                                                                                  |
| Faculty                             | `course_instructors`                   | 0–20; exactly one primary when non-empty                                                                                                                                                                                |
| Duration                            | `duration_minutes int`                 | **Unit: minutes** of estimated total learning time (1 – 600,000). Not an access/validity period (B-02)                                                                                                                  |
| Price                               | `price_minor int` + `currency char(3)` | **Minor units** (paise). `0` = free, `null` = not decided. Max ₹10,00,000.00. Currency from `SUPPORTED_CURRENCIES` = `['INR']` (M-03 assumption). Both or neither (CHECK)                                               |
| Discount                            | `discount_type` + `discount_value`     | `PERCENTAGE` 1–100 (whole percent) or `FIXED_AMOUNT` 1–price (minor units). Only on a paid course. **No final/checkout price is computed** (PHASE 10, M-06)                                                             |
| Status                              | `publication_status`                   | `DRAFT` → `PUBLISHED` → `DRAFT`; `DRAFT` ↔ `ARCHIVED`. Changed only by the lifecycle endpoints                                                                                                                          |
| Visibility                          | `course_visibility`                    | `PUBLIC` (default) · `UNLISTED` · `PRIVATE` — see §3.1                                                                                                                                                                  |

Price and discount are **administration-only**: they are not returned by public endpoints or shown on the website until payments exist (M-01, PHASE 10).

## 3. Publication and visibility

### 3.1 Status and visibility are independent

`status` says whether the course is live; `visibility` says **who** can see it once live. A course that is not `PUBLISHED` is never public, whatever its visibility.

| Status \ Visibility | PUBLIC                   | UNLISTED                                       | PRIVATE                                                     |
| ------------------- | ------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| DRAFT / ARCHIVED    | hidden (404)             | hidden (404)                                   | hidden (404)                                                |
| PUBLISHED           | **listed** + detail page | **not listed**; detail page by link, `noindex` | hidden (404) — reserved for enrolled-only access (PHASE 10) |

Enforced in the API query itself (`PUBLIC_LISTING_WHERE`, `PUBLIC_DETAIL_WHERE` in `courses.repository.ts`). Every hidden case returns the **same 404** as an unknown slug, so a visitor cannot learn that a draft exists by guessing its slug.

### 3.2 Publication requirements

Defined once in `apps/api/src/modules/courses/publication.ts` (`evaluatePublication`, unit-tested):

| Code                                     | Rule                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `DESCRIPTION_REQUIRED`                   | A non-empty description                                               |
| `PLACEMENT_REQUIRED`                     | A category, or both a class and a subject                             |
| `CATEGORY/CLASS/STREAM/SUBJECT_INACTIVE` | Every linked catalogue row is active                                  |
| `INSTRUCTOR_REQUIRED`                    | At least one assigned faculty member with an active `FACULTY` account |
| `PUBLISHED_LESSON_REQUIRED`              | At least one lesson with status `PUBLISHED`                           |
| `LESSON_CONTENT_MISSING`                 | Every published lesson has the content its type needs (§4)            |

The rules run (1) on `POST …/publish` (422 with every unmet rule in `error.details`), (2) in every admin course response (`publication: { eligible, issues }`, shown as a checklist), and (3) **after every change to a published course or its curriculum** — a change that would make a live course ineligible is rolled back with 422 ("unpublish first"). The rule list itself is pending client approval (Z-04).

### 3.3 Lifecycle and concurrency

```
DRAFT ──publish (eligible)──▶ PUBLISHED ──unpublish──▶ DRAFT
DRAFT ──archive──▶ ARCHIVED ──restore──▶ DRAFT
```

Every course mutation runs in a transaction that row-locks the course (`SELECT … FOR UPDATE`). Curriculum mutations lock the owning course too, so concurrent edits and reorders are serialised. `PATCH /admin/courses/:id` and the lifecycle endpoints accept `expectedUpdatedAt`; when the course changed since the editor loaded it, the API answers **409** instead of overwriting (the admin UI keeps the user's input and asks them to reload). Faculty changes bump `updatedAt`.

## 4. Lesson content types and storage

| Lesson type (`contentType`) | Required content (to be published)                               | Notes                                                      |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `VIDEO`                     | ≥ 1 `VIDEO` resource                                             | Link to a video page/file (YouTube, Vimeo, any HTTPS host) |
| `PDF`                       | ≥ 1 `PDF` resource                                               |                                                            |
| `DOCUMENT`                  | ≥ 1 `DOCUMENT` or `PRESENTATION` resource                        |                                                            |
| `LINK` (External resource)  | ≥ 1 `EXTERNAL_LINK` resource                                     |                                                            |
| `QUIZ`                      | Instructions (`body`)                                            | **Placeholder** — no questions/attempts/grading (PHASE 09) |
| `ASSIGNMENT`                | Instructions (`body`); resources optional (e.g. a worksheet PDF) | **Placeholder** — no submissions/grading (PHASE 09)        |
| `TEXT` (Phase 02)           | Lesson text (`body`)                                             |                                                            |

The rule table lives in `@asra/validation` (`LESSON_CONTENT_REQUIREMENTS`, `lessonContentIssue`) and is shared by the API and the curriculum editor. Lessons have their own status (`DRAFT` hidden / `PUBLISHED` ready); `publishedAt` follows the status.

**Storage.** No object-storage or video-hosting provider has been chosen (R-01, G-01), so:

- resources are **references**: an external `https://` URL on a public domain, without credentials (`safeExternalUrlSchema`; `javascript:`, `data:`, `http:`, `localhost`/IP hosts are rejected). The API stores URLs but **never fetches them** (no SSRF surface);
- the schema's provider-neutral `storageProvider` + `storageKey` location remains, but the API rejects it with 422 while `CONFIGURED_STORAGE_PROVIDERS` (`apps/api/src/config/storage.ts`) is empty;
- there is **no upload endpoint and no upload button**. Integrating a provider means: implement the `StorageProvider` adapter (ARCHITECTURE §8.3), add its id to `CONFIGURED_STORAGE_PROVIDERS`, add an upload/signed-URL flow, and serve stored files via signed URLs to enrolled students only (G-02, PHASE 07/10).

Resource URLs and lesson bodies are **never** returned by public endpoints.

## 5. Public website integration

### 5.1 Pages

- `/courses` — new "Available courses" section listing published `PUBLIC` courses from `GET /api/v1/courses` (paginated with `?coursesPage=`), above the existing programme directory. Honest empty state when nothing is published; a non-blocking notice if the API is unreachable. The page now renders per request.
- `/courses/<slug>` — a programme page for the five reserved slugs, otherwise the published course (outline of published lessons, placement, learning time, public faculty, enquiry CTA). Unknown/draft/private → 404; `UNLISTED` → `noindex`. Rendered per request (`dynamic = 'force-dynamic'`) so unpublishing takes effect immediately.
- Fees are shown as "To be announced" — prices are not public (§2).
- Faculty appear publicly only when their `FacultyProfile.isPublic` is true (C-02). There is no screen to set it yet (Z-05).

### 5.2 Reserved slugs

`english`, `entrepreneurship`, `quranic-studies`, `arabic`, `urdu` (`RESERVED_COURSE_SLUGS`) belong to the Phase 05 programme pages and are rejected as course slugs. A web test keeps the list in sync with `content/programmes.ts`. Whether real courses should eventually replace those pages is Z-08.

### 5.3 Not changed

The sitemap still lists only static pages; published course URLs are not added yet (they need a request-time sitemap) — see Z-09. The programme catalogue (`content/programmes.ts`) is unchanged and still describes the Order's programmes.

## 6. API

All responses use the standard envelope; lists return `{ items, pagination: { page, pageSize, total, pageCount } }` (`?page=1&pageSize=20`, max 100). Bodies are Zod `.strict()` (unknown keys → 422, preventing mass assignment of ids, status, timestamps). Field problems come back as `error.details: [{ path: ['field'], message }]` with 422 (invalid) or 409 (conflict, e.g. duplicate slug). Admin responses carry `Cache-Control: no-store`.

### 6.1 Admin — `/api/v1/admin` (Bearer token required)

| Permission                  | Endpoints                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `academic_structure.manage` | `GET/POST /academic-levels`, `GET/PATCH/DELETE /academic-levels/:id`; same for `/classes`, `/streams`, `/subjects` (`?q=&isActive=&academicLevelId=`) |
| `courses.manage`            | `GET/POST /course-categories`, `GET/PATCH/DELETE /course-categories/:id`                                                                              |
| `courses.manage`            | `GET /courses?q=&status=&visibility=&categoryId=&classId=&subjectId=`, `POST /courses`, `GET/PATCH/DELETE /courses/:id`                               |
| `courses.manage`            | `PUT /courses/:id/instructors` `{ instructors: [{ facultyProfileId, isPrimary }] }`; `GET /faculty?q=&limit=`                                         |
| `courses.manage`            | `POST /courses/:id/publish`, `/unpublish`, `/archive`, `/restore` — body `{ expectedUpdatedAt? }` (optional)                                          |
| `content.manage`            | `GET /courses/:id/curriculum` (full tree)                                                                                                             |
| `content.manage`            | `GET/POST /courses/:id/modules`, `PUT /courses/:id/modules/order`, `PATCH/DELETE /modules/:id`                                                        |
| `content.manage`            | `GET/POST /modules/:id/chapters`, `PUT /modules/:id/chapters/order`, `PATCH/DELETE /chapters/:id`                                                     |
| `content.manage`            | `GET/POST /chapters/:id/lessons`, `PUT /chapters/:id/lessons/order`, `GET/PATCH/DELETE /lessons/:id`                                                  |
| `content.manage`            | `GET/POST /lessons/:id/resources`, `PUT /lessons/:id/resources/order`, `PATCH/DELETE /resources/:id`                                                  |

Reorder bodies are `{ orderedIds: [...] }` and must list **exactly** the current children (no foreign or missing ids → 422). New items are appended. Curriculum services resolve the owning course from the database (never from the request) and apply `accessPolicy.assertCanManageCourseContent` — the hook for faculty access in PHASE 08. Students and faculty get 403; anonymous callers 401.

### 6.2 Public — `/api/v1/courses` (no authentication)

| Endpoint             | Returns                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /courses`       | Published `PUBLIC` courses, newest first. `?page=&pageSize=` (max 50) `&q=&category=&class=&subject=` (slugs) |
| `GET /courses/:slug` | A published `PUBLIC`/`UNLISTED` course with the outline of its published lessons; otherwise 404               |

No rate limiter is applied to the public catalogue: the website's server renders these pages from one IP, so a per-IP limit would throttle the site itself (revisit with a CDN/edge limit in PHASE 13).

## 7. Admin portal (web)

`/admin` (route group `(admin)`) — `AuthProvider` + `AdminShell`. Anonymous users are sent to `/login?next=/admin/...` (only same-site paths are honoured after sign-in); signed-in users without an admin permission see "No access". Navigation is filtered by permission. **The API is the security boundary**; the shell only decides what to show.

| Page                                                                                | What it does                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                                                            | Real counts (courses, published, drafts, categories) and shortcuts                                                                                                                                                                                                                                                                                                                                         |
| `/admin/academic-levels`, `/classes`, `/streams`, `/subjects`, `/course-categories` | Search, active/level filters, pagination; create/edit dialog; activate/deactivate; delete with confirmation (refused with the API's message when in use)                                                                                                                                                                                                                                                   |
| `/admin/courses`                                                                    | Search; status/visibility/category/class/subject filters; pagination; title + thumbnail, class & subject, faculty, category, price/discount, status, visibility, last updated                                                                                                                                                                                                                              |
| `/admin/courses/new`                                                                | Course form → creates a draft and opens it                                                                                                                                                                                                                                                                                                                                                                 |
| `/admin/courses/:id`                                                                | Tabs: **Publishing** (checklist with "Fix this" links, Publish/Unpublish/Archive/Restore/Delete with confirmation; state changes only after the API confirms), **Details** (course form with stale-edit detection), **Faculty** (assign + primary), **Curriculum** (modules → chapters → lessons with Move up/down, add/edit/delete; lesson dialog manages resource links and shows "needs content" hints) |

Forms validate with the same Zod schemas as the API, show server field errors next to the field, disable submit while saving, and keep input after errors. Data is loaded with a small `useApiResource` hook over `authorizedRequest` (TanStack Query is not part of the approved stack yet). Reordering uses explicit buttons — no drag-and-drop dependency.

### 7.1 Workflow (Class 10 Mathematics)

1. Academic levels → add "Classes 6–10". Classes → add "Class 10" (level: Classes 6–10). Subjects → add "Mathematics". Course categories → add "School Education".
2. Courses → New course: title, description, category, class, subject (optional: duration, price, visibility) → **Create course**.
3. Faculty tab: tick the teacher, choose the primary → **Save faculty**. (Faculty accounts are created with `npm run auth:create-user -- --role FACULTY` until staff management exists, S-05.)
4. Curriculum tab: **Add module** → **Add chapter** → **Add lesson** (type Video). In the lesson dialog **Add resource link** (video URL, PDF URL); set status **Published (ready)** → **Save lesson**.
5. Publishing tab: the checklist turns green → **Publish** → confirm. The public page is at `/courses/<slug>`.
6. **Unpublish** removes it from `/courses` and the course page returns 404 immediately.

## 8. Database migration

Migration `20261015071102_phase06_course_management` (additive only — no data is rewritten or removed):

- enums `course_visibility`, `discount_type`; `lesson_content_type` gains `PDF`, `QUIZ`, `ASSIGNMENT`;
- `courses`: `visibility` (default `PUBLIC`), `thumbnail_url`, `duration_minutes`, `price_minor`, `currency`, `discount_type`, `discount_value`; index `(status, visibility)`;
- nine CHECK constraints (DATABASE.md §4.2.2).

Local: `npm run db:migrate` (applies pending migrations, guarded to local hosts). Neon/staging: `npm run db:migrate:deploy`. No seed changes — no academic catalogue or courses are seeded (A-01, B-01).

## 9. Tests and verification

| Suite                                       | Covers                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/tests/academics.test.ts`          | CRUD, field-level 422, unknown keys, duplicates (case-insensitive, per level), slug collisions, reference-safe delete, 401/403 for anonymous/student/faculty                                                                                                                                             |
| `apps/api/tests/courses.test.ts`            | Create/update, slug generation/reserved/duplicates, relation validation (missing, inactive, stream ↔ class), pricing/discount/duration rules, thumbnail URL safety, list filters, optimistic concurrency, faculty assignment, lifecycle, published-course guard, authorization, publication rules (unit) |
| `apps/api/tests/curriculum.test.ts`         | Hierarchy, ordering/reordering, cross-course/cross-chapter manipulation, 404 parents, non-cascading deletes, six lesson types, URL safety, storage refusal, published-course guard, authorization                                                                                                        |
| `apps/api/tests/public-catalog.test.ts`     | Drafts/archived/private never public; UNLISTED by slug only; unpublish removes; no leaks (URLs, bodies, prices, draft lessons, private faculty, ids); filters, pagination, validation                                                                                                                    |
| `apps/api/tests/acceptance-phase06.test.ts` | The 12-step exit-criteria workflow over HTTP                                                                                                                                                                                                                                                             |
| `apps/web/tests/course-management.test.tsx` | Money/duration/order helpers, course-form payload, redirect safety, portal access, reserved slugs ↔ programmes, public listing states (stubbed API), course page markup, `/courses/[slug]` routing                                                                                                       |

Run: `npm test` (API, local `*_test` database) and `npm test -w @asra/web`.

**Live run (2026-10-15).** The exit-criteria workflow was also run against a production build (`next build` + `next start`) and the API on the local test database, over HTTP: create Class 10 → Mathematics → course + faculty → module/chapter/lesson → video + PDF → hierarchy verified → publish (refused first while the lesson was draft) → listed on `/courses` and served at `/courses/<slug>` → unpublish → removed from `/courses`, page 404 → student 403 / anonymous 401. This run found two production-only bugs, both fixed: the API wrapper turned Next.js's request-time signal into a network error, and `/courses/[slug]` (prerendered for programmes) could not switch to request-time rendering.

**Not verified in a browser.** The admin UI's interactive behaviour (dialogs, tabs, focus, toasts, responsive layout) was type-checked, linted and built, and its pages were served, but it has **not been clicked through in a real browser** in this phase. Do that before release.
