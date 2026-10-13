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

### Planned

- PHASE 04 — Public Website & Design System.

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
