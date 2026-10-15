# ASRA Academy — Database

| Field   | Value                                                                |
| ------- | -------------------------------------------------------------------- |
| Version | 0.6.0                                                                |
| Status  | Phase 06 — course fields, visibility and lesson types added          |
| Schema  | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)  |
| Engine  | PostgreSQL 17 (Docker, local) · Neon PostgreSQL (staging/production) |
| ORM     | Prisma 7.10 with the `@prisma/adapter-pg` driver adapter             |

This document covers the data model, its conventions and constraints, and how to migrate, seed and reset the database. Architecture context: [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-database-responsibilities).

---

## 1. Entity overview

```
                 ┌──────────── Identity & access ────────────┐
                 │  Role ──< RolePermission >── Permission    │
                 │   │                                        │
                 │   └──< UserRole >── User                   │
                 │                     │ 1:1      │ 1:1       │
                 └─────────────────────┼──────────┼───────────┘
                          StudentProfile        FacultyProfile
                            │      │                  │
       ┌────── Academic ────┼──────┼──┐               │
       │  AcademicLevel ──< Class ◄───┘ (current)     │
       │        │                     │               │
       │        └──< Stream ◄─────────┘ (current)     │
       │  Subject                                     │
       └──┬─────────┬────────┬────────────────────────┘
          │ class?  │stream? │subject?                │
          ▼         ▼        ▼                        │
 CourseCategory ──< Course >──────< CourseInstructor >┘
                      │
                      └──< Module ──< Chapter ──< Lesson ──< Resource
```

`A ──< B` = one A has many B. `?` = optional (nullable foreign key).

| Model              | Table                | Purpose                                                                                |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------- |
| `User`             | `users`              | Central identity: email, password hash (Phase 03), name, status, email verification    |
| `Role`             | `roles`              | Named permission set (`SUPER_ADMIN`, `ADMIN`, `FACULTY`, `STUDENT`; more can be added) |
| `Permission`       | `permissions`        | Grantable capability with a stable key, e.g. `courses.manage`                          |
| `UserRole`         | `user_roles`         | **Additional join model** — User ↔ Role (many-to-many)                                 |
| `RolePermission`   | `role_permissions`   | **Additional join model** — Role ↔ Permission (many-to-many)                           |
| `StudentProfile`   | `student_profiles`   | Student academic data, 1:1 with User                                                   |
| `FacultyProfile`   | `faculty_profiles`   | Faculty professional data, 1:1 with User                                               |
| `AcademicLevel`    | `academic_levels`    | Band of school education, e.g. "Classes 6–10", "Classes 11–12"                         |
| `Class`            | `classes`            | School grade, e.g. "Class 10"; belongs to one academic level                           |
| `Stream`           | `streams`            | Stream within a level, e.g. Science (Classes 11–12); list pending                      |
| `Subject`          | `subjects`           | Reusable subject, e.g. Mathematics                                                     |
| `CourseCategory`   | `course_categories`  | Admin-managed course grouping                                                          |
| `Course`           | `courses`            | Enrollable unit: a subject for a class (± stream), or a special course                 |
| `CourseInstructor` | `course_instructors` | Course ↔ FacultyProfile assignment with `isPrimary`                                    |
| `Module`           | `modules`            | Ordered section of a course                                                            |
| `Chapter`          | `chapters`           | Ordered section of a module                                                            |
| `Lesson`           | `lessons`            | Ordered learning item in a chapter (video, document, text, link)                       |
| `Resource`         | `resources`          | Learning material attached to a lesson (storage object or external URL)                |

### Why the two additional models

`UserRole` and `RolePermission` are explicit join tables rather than Prisma implicit many-to-many relations. This gives:

- snake_case table and column names, consistent with every other table;
- an assignment timestamp (`assigned_at`, `granted_at`), which audit logging (FR-AUD-001) will need;
- `RESTRICT` on role deletion while users still hold that role.

No other models were added beyond the Phase 02 list.

## 2. Key design decisions

### 2.1 Users and roles: many-to-many

The requirements do not say whether a user can hold more than one role. Admin sub-roles are pending (S-01), and a faculty member who is also an admin is plausible. The schema therefore uses the **least restrictive** model: a user can hold several roles through `user_roles`.

A one-role-per-user policy, if the client confirms it, can be enforced in the Phase 03 service layer without a schema change. This is recorded as **CLIENT-CLARIFICATIONS S-04**.

Roles are **rows, not a PostgreSQL enum**. New roles (e.g. Parent/Guardian, Accounts) need no migration. `Role.isSystem` marks seeded roles that administrators must not delete.

### 2.2 Profiles are separate from User

`User` holds identity and authentication data only. Student and faculty data live in `StudentProfile` and `FacultyProfile` (each `user_id UNIQUE`, so at most one of each per user). A profile is deleted with its user (`CASCADE`).

Registration fields, date of birth, guardian details and parental consent are **pending** (D-01, E-01). They are deliberately absent and will be added by a later migration once confirmed.

### 2.3 Academic structure

- `AcademicLevel 1──< Class` and `AcademicLevel 1──< Stream`. Class and stream names are unique within a level; slugs are globally unique.
- `Subject` is **independent** of class and stream. Where a subject is taught is expressed by a **Course** (`class_id`, `stream_id`, `subject_id`, all optional). This follows SRS §1.3: a course is "a subject for a class, or a special course". No class–subject mapping table is introduced until the client confirms the subject list per class and stream (A-01, A-02).
- `AcademicLevel.board` is a free-text curriculum label (e.g. "CBSE"). Supporting more boards (A-03) does not need a redesign. `Class.gradeNumber` is deliberately **not unique**, so a second board can reuse the same grades.
- Faculty subject allocation (FR-FAC-002) is derived from course assignments. If the client needs allocation independent of courses, a `faculty_subjects` table can be added in Phase 06.
- **No academic catalogue is seeded.** Classes, streams, subjects and categories are created by admins (Phase 06).

### 2.4 Courses

- `status` (`DRAFT` | `PUBLISHED` | `ARCHIVED`). `published_at` is required once a course is published (CHECK).
- `visibility` (`PUBLIC` | `UNLISTED` | `PRIVATE`, Phase 06) is independent of `status`; see [COURSE-MANAGEMENT.md §3](./COURSE-MANAGEMENT.md#3-publication-and-visibility).
- `category_id`, `class_id`, `stream_id` and `subject_id` are all optional. Special courses have no class, and school courses do not require a category.
- **Phase 06 fields:** `thumbnail_url` (HTTPS, exclusive with `thumbnail_key`), `duration_minutes` (estimated learning time, minutes), `price_minor` + `currency` (minor units, ISO 4217; `0` = free), `discount_type` + `discount_value` (percentage 1–100 or fixed amount ≤ price). Price data is administration-only; no checkout price is derived (PHASE 10).
- **Not modelled yet:** language, level, batches and validity (B-02…B-04, A-06).
- `course_instructors` links to `faculty_profiles`, not `users`, so only faculty can be instructors. "Exactly one primary instructor when any are assigned" is a **service-layer rule**, implemented in Phase 06 (`courseInstructorsSchema`). Prisma 7.10 cannot declare the partial unique index this would need without the index being reported as drift.

### 2.5 Curriculum and content

```
Course ──< Module ──< Chapter ──< Lesson ──< Resource
```

- Each level has a 0-based `position`, unique within its parent (`@@unique([parentId, position])`) and non-negative (CHECK).
- To **reorder** siblings, do it inside one transaction. The unique index is not deferrable, so first move the affected rows to temporary positions (e.g. negative values are rejected, so use `position + 10000`), then write their final positions.
- `Lesson`: `content_type` (`VIDEO` | `DOCUMENT` | `TEXT` | `LINK`, plus `PDF` | `QUIZ` | `ASSIGNMENT` from Phase 06 — quiz/assignment are placeholders until PHASE 09), optional `body`, `status`, `duration_seconds`, `is_preview` (H-04 assumption) and `published_at` (required when published).
- `Resource` never stores binary data. It points to **exactly one** location:
  - a stored object: `storage_provider` + `storage_key` (provider-neutral, e.g. `s3`, `r2` or `vimeo` with the object key); or
  - an external URL: `external_url`.

  The CHECK `resources_location_exclusive` enforces this, and `EXTERNAL_LINK` resources must use a URL. The Zod schema `resourceInputSchema` in `@asra/validation` mirrors the same rule for API input. Since Phase 06 external URLs must be `https://` on a public domain, and the API refuses stored-object locations while no storage provider is configured (`apps/api/src/config/storage.ts`). Upload and signed URLs come in a later phase (R-01, G-01).

## 3. Conventions

| Topic        | Convention                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming       | Models `PascalCase` singular → tables `snake_case` plural (`@@map`). Fields `camelCase` → columns `snake_case` (`@map`). Enums `snake_case` types.                                |
| Primary keys | `UUID DEFAULT gen_random_uuid()` (built into PostgreSQL ≥ 13, available on Neon). IDs are generated by the database, so raw SQL and Prisma agree. Join tables use composite keys. |
| Timestamps   | `created_at` / `updated_at` as `timestamptz(3)`. Prisma writes UTC; `updated_at` is maintained by Prisma (`@updatedAt`).                                                          |
| Strings      | Bounded `varchar(n)` for identifiers, names and keys; `text` for long-form descriptions and bodies.                                                                               |
| Emails       | Stored trimmed and lower-case (CHECK), so the plain unique index is case-insensitive. Normalise with `emailSchema` from `@asra/validation`.                                       |
| Slugs        | `^[a-z0-9]+(-[a-z0-9]+)*$` (CHECK) and unique per table. Validate with `slugSchema`.                                                                                              |
| Archival     | Catalogue rows (levels, classes, streams, subjects, categories) are retired with `is_active = false`. There is no global soft-delete.                                             |
| Deletion     | `RESTRICT` from catalogue rows and from roles and faculty in use. `CASCADE` down the curriculum tree and from a user to its profiles and role links.                              |
| Updates      | All foreign keys use `ON UPDATE CASCADE` (UUID keys are never expected to change).                                                                                                |

## 4. Constraints

### 4.1 Unique

| Table                                                    | Unique on                                        |
| -------------------------------------------------------- | ------------------------------------------------ |
| `users`                                                  | `email`                                          |
| `roles` / `permissions`                                  | `key`                                            |
| `user_roles` / `role_permissions` / `course_instructors` | composite primary key (no duplicate assignments) |
| `student_profiles`                                       | `user_id`, `student_code`                        |
| `faculty_profiles`                                       | `user_id`, `employee_code`                       |
| `academic_levels`                                        | `name`, `slug`                                   |
| `classes` / `streams`                                    | `slug`; `(academic_level_id, name)`              |
| `subjects`                                               | `name`, `slug`, `code`                           |
| `course_categories`                                      | `name`, `slug`                                   |
| `courses`                                                | `slug`                                           |
| `modules` / `chapters` / `lessons` / `resources`         | `(parent_id, position)`                          |

Nullable unique columns (`student_code`, `employee_code`, `subjects.code`) allow any number of `NULL`s.

### 4.2 CHECK constraints (hand-written in the migration SQL)

Prisma cannot declare CHECK constraints. They are appended to `20261013042559_init_database_core/migration.sql`. Prisma Migrate does not diff CHECK constraints, so later migrations keep them; verify with `npm run db:migrate`, which reports "Already in sync".

| Constraint                                                                | Rule                                         |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| `users_email_normalized`                                                  | `email = lower(btrim(email))` and not empty  |
| `roles_key_format`                                                        | `^[A-Z][A-Z0-9_]*$`                          |
| `permissions_key_format`                                                  | `resource.action` in lower snake case        |
| `*_slug_format` (levels, classes, streams, subjects, categories, courses) | slug pattern                                 |
| `classes_grade_number_positive`                                           | `grade_number > 0`                           |
| `faculty_profiles_experience_years_non_negative`                          | `experience_years >= 0`                      |
| `modules/chapters/lessons/resources_position_non_negative`                | `position >= 0`                              |
| `lessons_duration_seconds_non_negative`                                   | `duration_seconds >= 0`                      |
| `resources_size_bytes_non_negative`                                       | `size_bytes >= 0`                            |
| `courses_published_at_required`, `lessons_published_at_required`          | `PUBLISHED` ⇒ `published_at IS NOT NULL`     |
| `resources_location_exclusive`                                            | (provider + key) XOR external URL            |
| `resources_external_link_has_url`                                         | `EXTERNAL_LINK` ⇒ `external_url IS NOT NULL` |

### 4.2.1 Phase 03 CHECK constraints (`20261013045953_auth_sessions_and_tokens`)

| Constraint                                                                                                         | Rule                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `auth_sessions_token_hash_format`, `auth_sessions_previous_token_hash_format`, `one_time_tokens_token_hash_format` | `^[0-9a-f]{64}$` — only SHA-256 digests can be stored, never a raw token |
| `auth_sessions_revocation_consistent`                                                                              | `revoked_at` and `revoked_reason` are both set or both null              |
| `auth_sessions_expires_after_created`, `one_time_tokens_expires_after_created`                                     | `expires_at > created_at`                                                |

Unique: `auth_sessions.token_hash`, `auth_sessions.previous_token_hash`, `one_time_tokens.token_hash`. Indexes: `(user_id, revoked_at)`, `(user_id, purpose)`, `expires_at` (future cleanup job). Both tables `CASCADE` from `users`. Design rationale: [AUTHENTICATION.md](./AUTHENTICATION.md).

### 4.2.2 Phase 06 CHECK constraints (`20261015071102_phase06_course_management`)

| Constraint                             | Rule                                               |
| -------------------------------------- | -------------------------------------------------- |
| `courses_duration_minutes_positive`    | `duration_minutes IS NULL OR > 0`                  |
| `courses_price_minor_non_negative`     | `price_minor IS NULL OR >= 0`                      |
| `courses_price_currency_consistent`    | price and currency both set or both null           |
| `courses_currency_format`              | `currency ~ '^[A-Z]{3}$'`                          |
| `courses_discount_consistent`          | discount type and value both set or both null      |
| `courses_discount_requires_price`      | a discount needs `price_minor > 0`                 |
| `courses_discount_value_valid`         | `PERCENTAGE` 1–100; `FIXED_AMOUNT` 1–`price_minor` |
| `courses_thumbnail_location_exclusive` | not both `thumbnail_key` and `thumbnail_url`       |
| `courses_thumbnail_url_https`          | `thumbnail_url ~ '^https://'`                      |

The same rules are validated first by the Zod schemas in `@asra/validation` (`courses.ts`) so clients get field-level errors; the CHECKs are the backstop. New index: `courses(status, visibility)` for the public catalogue.

### 4.3 Indexes

Besides the unique indexes above, there are B-tree indexes on:

- every foreign key not already covered by a unique or composite index (`user_roles.role_id`, `role_permissions.permission_id`, `student_profiles.class_id`/`stream_id`, `course_instructors.faculty_profile_id`, `courses.category_id`/`stream_id`/`subject_id`, and `(class_id, subject_id)`);
- the main listing filters: `users.status`, `courses(status, published_at)`, `lessons.status`, `faculty_profiles.is_public`, `classes.grade_number`, and `(is_active, sort_order)` on catalogue tables.

## 5. Connections: local vs. Neon

| Variable              | Used by                                          | Local (Docker)                               | Neon (staging/production)                                |
| --------------------- | ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`        | Running API (`pg` pool via `@prisma/adapter-pg`) | `postgresql://…@localhost:5432/asra_academy` | **Pooled** endpoint (`…-pooler…`) with `sslmode=require` |
| `DIRECT_DATABASE_URL` | Prisma CLI (`prisma.config.ts`): migrate, studio | same as `DATABASE_URL`                       | **Direct** endpoint with `sslmode=require`               |
| `DATABASE_POOL_MAX`   | API pool size per process (default 10)           | default                                      | keep small; the Neon pooler multiplexes                  |
| `TEST_DATABASE_URL`   | Automated tests (optional)                       | defaults to `<DATABASE_URL db>_test`         | **never** Neon (refused by the test harness)             |

In Prisma 7 the schema's `datasource` block holds no URL:

- `prisma.config.ts` supplies the CLI URL (`DIRECT_DATABASE_URL`, falling back to `DATABASE_URL`);
- the runtime client receives `DATABASE_URL` through the driver adapter (`apps/api/src/database/prisma.ts`).
- the seed (`prisma db seed` → `prisma/seed.ts`) uses that same runtime client, so it connects through `DATABASE_URL`.

Migrations go over the direct connection because they take advisory locks, which PgBouncer transaction pooling does not support.

## 6. Day-to-day workflow (local)

All commands run from the repository root.

```bash
# 1. Start PostgreSQL + Redis and wait for "(healthy)"
docker compose up -d
docker compose ps

# 2. Check PostgreSQL readiness directly (optional)
docker exec asra-postgres pg_isready -U asra -d asra_academy

# 3. Generate the Prisma client and validate the schema
npm run db:generate
npm run db:validate

# 4. Apply all migrations (creates the database objects on a fresh volume)
npm run db:migrate

# 5. Seed reference data (roles + permissions) — safe to repeat
npm run db:seed

# 6. Inspect data
npm run db:studio            # http://localhost:5555
npm run check:services       # PostgreSQL + Redis connectivity
npm run db:migrate:status    # applied vs. pending migrations
```

### Changing the schema

1. Edit `apps/api/prisma/schema.prisma`.
2. Run `npm run db:migrate -- --name <short_snake_case_name>`. This creates `prisma/migrations/<timestamp>_<name>/migration.sql`, applies it locally and regenerates the client.
   - To review or hand-edit the SQL first (e.g. to add a CHECK constraint or a data backfill), run `npm run db:migrate:create -- --name <name>`, edit the file, then run `npm run db:migrate`.
3. Run `npm test -w @asra/api`. The schema test fails if the migrations and `schema.prisma` disagree.
4. Commit the schema **and** the new migration folder together. Never edit a migration that has already been applied outside your machine; add a new migration instead.

### Command reference

| Root command                | Runs                                         | Notes                                                          |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `npm run db:generate`       | `prisma generate`                            | Client output: `apps/api/src/generated/prisma` (git-ignored)   |
| `npm run db:validate`       | `prisma validate`                            |                                                                |
| `npm run db:migrate`        | `prisma migrate dev` (guarded)               | **Local hosts only**; can prompt to reset on drift             |
| `npm run db:migrate:create` | `prisma migrate dev --create-only` (guarded) | Create SQL without applying                                    |
| `npm run db:migrate:deploy` | `prisma migrate deploy`                      | Applies committed migrations only. Use for Neon. Never resets. |
| `npm run db:migrate:status` | `prisma migrate status`                      | Read-only                                                      |
| `npm run db:seed`           | `prisma db seed` → `apps/api/prisma/seed.ts` | Idempotent                                                     |
| `npm run db:studio`         | `prisma studio` on :5555                     |                                                                |
| `npm run db:reset`          | `prisma migrate reset` + seed (guarded)      | ⚠ **Destroys all local data**; asks for confirmation           |

"Guarded" commands go through `apps/api/scripts/db-command.ts`. It refuses to run when `NODE_ENV=production` or when the migration URL's host is not local (`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`). A Neon URL is therefore always rejected.

## 7. Resetting the local database

```bash
npm run db:reset
```

This **drops every table and all data** in the local database. It then re-applies all migrations and runs the seed. Prisma asks for confirmation first, and the guard refuses non-local hosts.

To wipe the Docker volume entirely (e.g. after changing `POSTGRES_PASSWORD`):

```bash
docker compose down -v      # deletes the asra_postgres_data volume
docker compose up -d
npm run db:migrate && npm run db:seed
```

Nothing resets the database automatically: not `npm run dev`, not API startup, and not CI.

## 8. Seed

`apps/api/prisma/seed.ts` calls `seedAccessControl()` (`apps/api/src/database/seed/`). The seed creates **only** RBAC reference data:

| Permission                  | Requirement                 | SUPER_ADMIN | ADMIN | FACULTY | STUDENT |
| --------------------------- | --------------------------- | :---------: | :---: | :-----: | :-----: |
| `system.manage`             | SRS §4                      |      ✓      |       |         |         |
| `admins.manage`             | FR-ADM-014                  |      ✓      |       |         |         |
| `roles.manage`              | FR-RBAC-005                 |      ✓      |       |         |         |
| `students.manage`           | FR-ADM-001                  |      ✓      |   ✓   |         |         |
| `faculty.manage`            | FR-ADM-002                  |      ✓      |   ✓   |         |         |
| `academic_structure.manage` | FR-ADM-003, FR-ACA-003      |      ✓      |   ✓   |         |         |
| `courses.manage`            | FR-ADM-004                  |      ✓      |   ✓   |         |         |
| `content.manage`            | FR-ADM-009                  |      ✓      |   ✓   |         |         |
| `content.manage_assigned`   | FR-FAC-003/004, FR-RBAC-003 |      ✓      |       |    ✓    |         |
| `content.view_enrolled`     | FR-RBAC-004                 |      ✓      |       |         |    ✓    |
| `profile.manage_own`        | FR-STU-008                  |      ✓      |   ✓   |    ✓    |    ✓    |

Permission keys are shared with the web app as `PERMISSIONS` in `@asra/types`. Permissions for later modules (enrolments, payments, assessments, certificates, notifications and reports) will be added in their phases.

Properties:

- **Idempotent.** Roles and permissions are upserted by `key`, and grants use `createMany({ skipDuplicates: true })`. Re-running changes nothing (this is covered by tests).
- **Additive.** The seed never removes grants, so permissions an administrator adds later survive a re-seed. Removing a permission from the definitions requires an explicit migration or admin action.
- **Atomic.** The seed runs in one interactive transaction (~18 sequential round trips: one upsert per permission and role, then one grant insert). Its limits are raised above Prisma's 5 s default (`SEED_TRANSACTION_OPTIONS`) because, run from a workstation against remote Neon, each round trip can take a few hundred milliseconds.
- **No accounts.** No administrator, test user, password or email is seeded. Staff accounts (including the first Super Admin) are created explicitly with `npm run auth:create-user -- --email … --name "…" --role SUPER_ADMIN` (password via hidden prompt or `NEW_USER_PASSWORD`) — see [AUTHENTICATION.md §7](./AUTHENTICATION.md#7-provisioning-staff-accounts).
- **No academic catalogue.** The final classes, streams, subjects and courses are pending client confirmation; administrators create them in the Phase 06 admin portal.

## 9. Neon (staging / production)

Neon credentials were **not available during Phase 02**. Connectivity to Neon has **not been tested**; all verification used local Docker PostgreSQL.

To verify a Neon branch:

1. In the Neon console, create (or select) a project in the region closest to India (W-02), plus a branch (e.g. `dev`).
2. Copy **both** connection strings, each with `sslmode=require`:
   - Pooled (host contains `-pooler`) → `DATABASE_URL`
   - Direct → `DIRECT_DATABASE_URL`
3. Set them in the shell or the deployment platform's secret store, never in a committed file:

   ```bash
   export DATABASE_URL='postgresql://…-pooler…/asra?sslmode=require'
   export DIRECT_DATABASE_URL='postgresql://…/asra?sslmode=require'
   ```

4. Apply migrations with the non-destructive command: `npm run db:migrate:deploy`.
5. Check status: `npm run db:migrate:status` (expect "Database schema is up to date").
6. Seed reference data: `npm run db:seed`.
7. Check connectivity: `npm run check:services`. Alternatively, start the API and call `GET /api/v1/health/ready` (expect `"database": "up"`).

Production rules:

- Migrations are applied **deliberately**, as a deployment step (`db:migrate:deploy`), never on API startup.
- `db:migrate`, `db:migrate:create` and `db:reset` cannot target Neon; the guard refuses them.
- Use a dedicated least-privilege runtime role for `DATABASE_URL` where possible (FR-SEC-006). The migration role needs DDL rights.
- Backups and point-in-time recovery are provided by Neon. Retention is pending (W-05).

## 10. Tests

`npm test -w @asra/api` uses Node's built-in test runner with `tsx`, so no extra dependencies are needed. It runs against a **separate local database**: `TEST_DATABASE_URL`, or by default `DATABASE_URL` with `_test` appended (`asra_academy_test`). The harness refuses any non-local host and any database whose name does not end in `_test`.

Before the tests run, `npm run test:db:prepare -w @asra/api` creates the test database if needed and applies migrations with `migrate deploy`.

| File                     | Covers                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/schema.test.ts`   | `prisma validate`, migration status, migrations ≡ schema (no drift), generated models, CHECK constraints present                                              |
| `tests/seed.test.ts`     | Roles and permissions created, per-role grants, idempotency, additive behaviour                                                                               |
| `tests/database.test.ts` | Connectivity (up/down), unique/FK/CHECK enforcement, cascades, RESTRICT, UUIDs, UTC timestamps, error mapping                                                 |
| `tests/http.test.ts`     | Health/readiness, 404, malformed JSON, Zod validation → 422, Prisma errors → 409/422 without leaking SQL or row data                                          |
| Phase 06 suites          | `academics`, `courses`, `curriculum`, `public-catalog`, `acceptance-phase06` — see [COURSE-MANAGEMENT.md §9](./COURSE-MANAGEMENT.md#9-tests-and-verification) |

`resetAuthState()` (tests/support/auth.ts) rebuilds role grants from the seed definitions before each test, so a permission granted at runtime by one test cannot leak into another suite (the seed itself stays additive).
