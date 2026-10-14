# ASRA Academy

Online Learning Platform & Learning Management System (LMS) for **ASRA Academy**, developed by **Marvel's Techworks**.

ASRA Academy offers school education for **Classes 6–12** (CBSE pattern for 6–10, subject-specific coaching for 11–12) and special courses in **English Language, Entrepreneurship & Business, Quranic Studies, Arabic and Urdu**. The platform combines a responsive, SEO-friendly public website with Student, Faculty and Admin portals.

<p align="center"><img src="apps/web/public/brand/asra-academy-logo.png" alt="ASRA Academy — Learn • Grow • Succeed" width="200" /></p>

| Item       | Detail                                                  |
| ---------- | ------------------------------------------------------- |
| Tagline    | _Learn • Grow • Succeed_                                |
| Founded by | Students of AMU                                         |
| Contact    | [asraacademy1@gmail.com](mailto:asraacademy1@gmail.com) |
| Website    | www.asraacademy.in                                      |

Brand assets and colour usage rules: [docs/brand/README.md](docs/brand/README.md). Brand constants for the web app: [`apps/web/src/config/site.ts`](apps/web/src/config/site.ts).

> **Current phase:** PHASE 03 — Authentication & RBAC (implemented). LMS business features (dashboards, courses, enrolment) come in later phases.

---

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Docker setup](#docker-setup)
- [Environment variables](#environment-variables)
- [Running the frontend](#running-the-frontend)
- [Running the backend](#running-the-backend)
- [Database setup](#database-setup)
- [Prisma commands](#prisma-commands)
- [Development workflow](#development-workflow)
- [Git workflow](#git-workflow)
- [Current phase](#current-phase)
- [Future phases](#future-phases)
- [Documentation](#documentation)

---

## Architecture

A **modular monolith**: one Next.js web app and one Express.js API in a single npm-workspaces monorepo.

```
Browser
   ↓
Next.js (apps/web)
   ↓  REST /api/v1
Express.js (apps/api)
   ↓
Service layer → provider adapters (payment, live class, storage, email, WhatsApp)
   ↓
Prisma
   ↓
PostgreSQL — Neon (production) / Docker (local)
Redis — Docker (local); BullMQ background jobs in later phases
```

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Layer                 | Technology                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| Frontend              | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend               | Node.js, Express 5, TypeScript                                           |
| Database              | PostgreSQL 17 — **Neon** in production, Docker locally                   |
| ORM                   | Prisma 7 (`@prisma/adapter-pg` driver adapter)                           |
| Validation            | Zod 4 (shared via `@asra/validation`)                                    |
| Auth (Phase 03)       | JWT + bcrypt                                                             |
| Jobs (later)          | Redis + BullMQ                                                           |
| Data fetching (later) | TanStack Query                                                           |
| Tooling               | npm workspaces, ESLint 9, Prettier, Husky, lint-staged, GitHub Actions   |
| Local infra           | Docker Compose (PostgreSQL + Redis)                                      |

## Repository structure

```
asra-academy/
├── apps/
│   ├── web/                    Next.js frontend
│   │   ├── src/app/            App Router (layout, foundation page, 404)
│   │   ├── src/components/ui/  shadcn/ui components
│   │   ├── src/lib/            env, API client, utils
│   │   └── components.json     shadcn/ui configuration
│   └── api/                    Express.js backend
│       ├── prisma/             schema.prisma, seed.ts (migrations from Phase 02)
│       ├── prisma.config.ts    Prisma CLI configuration
│       ├── scripts/            check-services.ts (PostgreSQL + Redis connectivity)
│       └── src/
│           ├── config/         env validation (Zod), constants
│           ├── controllers/    HTTP layer
│           ├── middleware/     request logging, 404, central error handler
│           ├── routes/         /api/v1 routers
│           ├── services/       business logic
│           ├── repositories/   data access (Phase 02+)
│           ├── validators/     request schemas (Phase 02+)
│           ├── lib/            prisma, redis, logger clients
│           ├── utils/          response helpers, AppError
│           ├── types/          backend-only types
│           ├── app.ts          Express app composition
│           └── server.ts       entry point + graceful shutdown
├── packages/
│   ├── types/                  @asra/types — shared TS types (API envelope, roles)
│   ├── validation/             @asra/validation — shared Zod schemas
│   └── config/                 @asra/config — shared tsconfig presets
├── infrastructure/docker/      Postgres init SQL, Redis config
├── docs/                       PRD, SRS, architecture, requirements, clarifications, changelog
├── .github/workflows/ci.yml    CI pipeline
├── docker-compose.yml          Local PostgreSQL + Redis
├── eslint.config.mjs           Repo-wide ESLint flat config
└── package.json                Workspaces + root scripts
```

## Prerequisites

| Tool           | Version                                     |
| -------------- | ------------------------------------------- |
| Node.js        | ≥ 22.12 (24 LTS recommended — see `.nvmrc`) |
| npm            | ≥ 10                                        |
| Docker Desktop | with Docker Compose v2                      |
| Git            | any recent version                          |

## Local setup

```bash
# 1. Clone
git clone <repository-url> asra-academy
cd asra-academy

# 2. Install dependencies (all workspaces)
npm install

# 3. Create your local environment file, then set POSTGRES_PASSWORD (and the matching password
#    inside DATABASE_URL / DIRECT_DATABASE_URL) and JWT_SECRET (required) — generate it with:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
cp .env.example .env

# 4. Start PostgreSQL + Redis
docker compose up -d

# 5. Generate the Prisma client
npm run db:generate

# 6. Validate the Prisma schema
npm run db:validate

# 7. Apply migrations and seed roles/permissions
npm run db:migrate
npm run db:seed

# 8. (optional) Verify PostgreSQL + Redis connectivity
npm run check:services

# 9. Start the web app and API
npm run dev
```

Then open:

| Service       | URL                                         |
| ------------- | ------------------------------------------- |
| Web app       | http://localhost:3000                       |
| API health    | http://localhost:4000/api/v1/health         |
| API readiness | http://localhost:4000/api/v1/health/ready   |
| Prisma Studio | http://localhost:5555 (`npm run db:studio`) |

Expected health response:

```json
{
  "success": true,
  "message": "ASRA Academy API is running",
  "data": { "environment": "development" }
}
```

## Docker setup

Only infrastructure runs in Docker; the web app and API run on the host for fast hot reload.

| Service    | Image                | Port (configurable)    | Volume               |
| ---------- | -------------------- | ---------------------- | -------------------- |
| `postgres` | `postgres:17-alpine` | `POSTGRES_PORT` (5432) | `asra_postgres_data` |
| `redis`    | `redis:7.4-alpine`   | `REDIS_PORT` (6379)    | `asra_redis_data`    |

```bash
docker compose up -d        # start
docker compose ps           # both services should show "(healthy)"
docker compose logs -f      # follow logs
docker compose down         # stop — data is kept in named volumes
docker compose down -v      # stop and DELETE all local data
```

Shortcuts: `npm run docker:up`, `npm run docker:ps`, `npm run docker:logs`, `npm run docker:down`.

> Docker PostgreSQL is **for local development only**. Production uses **Neon**.

More: [infrastructure/docker/README.md](infrastructure/docker/README.md).

## Environment variables

All variables are documented in [`.env.example`](.env.example). A single root `.env` is read by Docker Compose, the API and the web app (the web app loads it in `next.config.ts`).

| Variable                                                             | Used by         | LOCAL                          | DEVELOPMENT / STAGING             | PRODUCTION                             |
| -------------------------------------------------------------------- | --------------- | ------------------------------ | --------------------------------- | -------------------------------------- |
| `NODE_ENV`                                                           | api, web        | `development`                  | `production`                      | `production`                           |
| `PORT`                                                               | api             | `4000`                         | platform-assigned                 | platform-assigned                      |
| `LOG_LEVEL`                                                          | api             | `info`/`debug`                 | `info`                            | `info`                                 |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | docker          | required                       | —                                 | —                                      |
| `DATABASE_URL`                                                       | api             | Docker Postgres                | Neon **pooled** URL (dev branch)  | Neon **pooled** URL                    |
| `DIRECT_DATABASE_URL`                                                | prisma CLI      | same as `DATABASE_URL`         | Neon **direct** URL               | Neon **direct** URL                    |
| `REDIS_URL`, `REDIS_PORT`                                            | api, docker     | Docker Redis                   | hosted Redis                      | hosted Redis                           |
| `JWT_SECRET`                                                         | api             | random ≥ 32 chars              | secret                            | secret (**required**)                  |
| `NEXT_PUBLIC_APP_URL`                                                | web, api (CORS) | `http://localhost:3000`        | staging URL                       | `https://www.asraacademy.in` (pending) |
| `NEXT_PUBLIC_API_URL`                                                | web             | `http://localhost:4000/api/v1` | staging API URL                   | production API URL                     |
| `CORS_ORIGINS`                                                       | api             | empty (defaults to app URL)    | optional                          | optional                               |
| `ENABLE_DESIGN_SYSTEM`                                               | web (server)    | not needed (always on in dev)  | optional `true` for client review | leave empty (showcase returns 404)     |
| `STORAGE_URL`, `STORAGE_KEY`, `STORAGE_SECRET`                       | api (later)     | optional                       | provider pending                  | provider pending                       |
| `PAYMENT_KEY`, `PAYMENT_SECRET`                                      | api (later)     | optional                       | sandbox keys                      | live keys                              |
| `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_API_KEY`                     | api             | `console`; key not needed      | `resend` + key, if sending        | `resend` + key + verified sender       |
| `WHATSAPP_API_KEY`                                                   | api (later)     | optional                       | if Business API chosen            | if Business API chosen                 |

The API validates its environment at startup and exits with a clear message if something is invalid. **Never commit `.env`.**

## Running the frontend

```bash
npm run dev:web             # builds shared packages, then next dev on :3000
npm run build -w @asra/web  # production build
npm run start:web           # serve production build
```

### Design system (Phase 04)

Tokens, components, education cards, layouts and motion are documented in [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md). The interactive showcase runs at **http://localhost:3000/design-system** in development (plus `/design-system/dashboard-preview` and `/design-system/admin-preview`). Production builds return 404 for it unless `ENABLE_DESIGN_SYSTEM=true`.

```bash
npm run test -w @asra/web   # web component and helper tests (Node test runner, no browser needed)
```

## Running the backend

```bash
npm run dev:api             # builds shared packages, then tsx watch on :4000
npm run build -w @asra/api  # compile to apps/api/dist
npm run start:api           # node dist/server.js
```

API conventions:

- Base path: `/api/v1`
- Success: `{ "success": true, "message": "...", "data": { ... } }`
- Error: `{ "success": false, "message": "...", "error": { "code": "NOT_FOUND" } }`
- Every response includes an `X-Request-Id` header.

## Authentication (Phase 03)

Full design: [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

- Pages: http://localhost:3000/register, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`.
- **Email in development:** with `EMAIL_TRANSPORT=console`, the verification and reset links are **printed in the API log**. Look for `[DEV EMAIL — not sent]`. Open the link to continue. Real delivery uses Resend (`EMAIL_TRANSPORT=resend`).
- Sign-in requires a verified email.
- Public registration creates **students only**. Create staff accounts with:

  ```bash
  npm run auth:create-user -- --email admin@example.com --name "Local Admin" --role ADMIN
  # roles: STUDENT | FACULTY | ADMIN | SUPER_ADMIN — the password is asked for at a hidden prompt
  ```

- API: `POST /api/v1/auth/{register,login,refresh,logout,logout-all,forgot-password,reset-password,verify-email,resend-verification}`, `GET /api/v1/auth/me`.
- **Tokens:**
  - the access token is kept in memory by the web app;
  - the refresh token lives only in an HttpOnly cookie.
- **Production:** the API will not start with `NODE_ENV=production` unless `EMAIL_TRANSPORT=resend`, `EMAIL_API_KEY` and a verified-domain `EMAIL_FROM` are set, and `AUTH_COOKIE_SECURE` must be true there.

## Database setup

- **Local:** `docker compose up -d` starts PostgreSQL. `DATABASE_URL` and `DIRECT_DATABASE_URL` both point at it.
- **Neon (development / production):** create a Neon project, then set
  - `DATABASE_URL` → the **pooled** connection string (host contains `-pooler`), used by the running API;
  - `DIRECT_DATABASE_URL` → the **direct** connection string, used by Prisma migrations.
- **Schema, migrations, seed, reset and Neon steps:** see [docs/DATABASE.md](docs/DATABASE.md).

## Prisma commands

Run from the repository root:

| Command                     | What it does                                                              |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm run db:generate`       | Generate the Prisma client into `apps/api/src/generated/prisma`           |
| `npm run db:validate`       | Validate `apps/api/prisma/schema.prisma`                                  |
| `npm run db:migrate`        | `prisma migrate dev` — create/apply migrations (**local hosts only**)     |
| `npm run db:migrate:create` | Create a migration without applying it (local only)                       |
| `npm run db:migrate:deploy` | `prisma migrate deploy` — apply committed migrations (staging/production) |
| `npm run db:migrate:status` | Show applied/pending migrations                                           |
| `npm run db:studio`         | Open Prisma Studio on http://localhost:5555                               |
| `npm run db:seed`           | Idempotently seed system roles and permissions                            |
| `npm run db:reset`          | ⚠ Drop all local data, re-migrate and seed (local only, asks to confirm)  |
| `npm test -w @asra/api`     | API tests against local `<db>_test` database                              |
| `npm run check:services`    | Verify PostgreSQL (via Prisma) and Redis connectivity                     |
| `npm test`                  | All API tests (DB, auth, RBAC, security) on the local `*_test` database   |
| `npm run auth:create-user`  | Provision a FACULTY / ADMIN / SUPER_ADMIN (or STUDENT) account            |

## Development workflow

| Command                     | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `npm run dev`               | Start API (:4000) and web (:3000) together         |
| `npm run build`             | Build shared packages, API and web                 |
| `npm run lint`              | ESLint across the monorepo (zero warnings allowed) |
| `npm run lint:fix`          | ESLint with auto-fix                               |
| `npm run format`            | Prettier — write                                   |
| `npm run format:check`      | Prettier — check only                              |
| `npm run typecheck`         | TypeScript strict checks in every workspace        |
| `npm run test -w @asra/web` | Web component tests                                |

**Pre-commit hook** (Husky + lint-staged): runs ESLint and a Prettier check on staged files. Type checking runs in CI.

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on pushes and PRs to `main`/`develop`: install → format check → lint → Prisma validate → Prisma generate → typecheck → web component tests → build → `docker compose config`. CI uses placeholder environment values and never connects to Neon.

### Adding a shadcn/ui component

```bash
cd apps/web
npx shadcn@latest add dialog
```

## Git workflow

```
feature/<short-name>  ──►  develop  ──►  main
```

| Branch      | Purpose                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `main`      | Production-ready, tagged releases only                                          |
| `develop`   | Integration branch; target for all feature PRs                                  |
| `feature/*` | New work, branched from `develop`                                               |
| `fix/*`     | Non-urgent fixes, branched from `develop`                                       |
| `hotfix/*`  | Urgent production fixes, branched from `main`, merged into `main` and `develop` |

Rules:

1. Never commit directly to `main`.
2. Open a pull request into `develop`; CI must pass before merge.
3. Release by merging `develop` → `main` and tagging (`v0.2.0`, …); update [docs/CHANGELOG.md](docs/CHANGELOG.md).
4. Never commit `.env`, secrets, API keys, `node_modules`, `.next`, `dist`, coverage or Docker data.

## Current phase

**PHASE 00 — Requirement Freeze & Project Preparation:** ✅ complete
**PHASE 01 — Project Foundation & Architecture:** ✅ complete
**PHASE 03 — Authentication & RBAC:** ✅ implemented: registration, login, rotating refresh sessions, logout, password reset, email verification, RBAC middleware, rate limiting, auth pages ([docs/AUTHENTICATION.md](docs/AUTHENTICATION.md))
**PHASE 04 — Design System & Frontend Foundation:** ✅ implemented: ASRA tokens, typography roles, core UI components, education cards, public/dashboard/admin layouts, motion, `/design-system` showcase ([docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md))
**PHASE 02 — Database & Backend Core:** ✅ implemented: LMS schema, initial migration, RBAC seed, database layer, error mapping, tests ([docs/DATABASE.md](docs/DATABASE.md))

- Monorepo, web and API foundations, shared packages
- PostgreSQL + Redis in Docker with health checks and persistent volumes
- Prisma configured (no domain models yet)
- Health/readiness endpoints, central error handling, CORS, Helmet, logging, graceful shutdown
- Linting, formatting, strict TypeScript, Git hooks, CI

Open client questions: [docs/CLIENT-CLARIFICATIONS.md](docs/CLIENT-CLARIFICATIONS.md).

## Future phases

| Phase | Scope                                                                  |
| ----- | ---------------------------------------------------------------------- |
| 02    | Database & Backend Core — LMS schema, migrations, module structure     |
| 03    | Authentication & RBAC — JWT, bcrypt, roles, guards                     |
| 04    | Design System & Frontend Foundation — ASRA tokens, components, layouts |
| 05    | Public Website — the 15 required pages, SEO, WhatsApp enquiry          |
| 06    | Academic & Course Management                                           |
| 07    | Student LMS                                                            |
| 08    | Faculty Portal                                                         |
| 09    | Assessment Engine — quizzes, assignments, exams                        |
| 10    | Enrolment & Payments                                                   |
| 11    | Live Classes & Notifications (Redis + BullMQ)                          |
| 12    | Admin Dashboard & Reporting                                            |
| 13    | Certificates; SEO, security & performance hardening                    |
| 14–16 | QA, UAT, production deployment, post-launch stabilisation              |

Detailed plan: [docs/reference/IMPLEMENTATION-PLAN-PHASES.md](docs/reference/IMPLEMENTATION-PLAN-PHASES.md).

## Documentation

| Document                                                       | Purpose                             |
| -------------------------------------------------------------- | ----------------------------------- |
| [docs/PRD.md](docs/PRD.md)                                     | Product requirements                |
| [docs/SRS.md](docs/SRS.md)                                     | Software requirements specification |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                   | System architecture                 |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)                   | Requirements matrix                 |
| [docs/DATABASE.md](docs/DATABASE.md)                           | Data model, migrations, seed, reset |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)               | Auth flows, tokens, RBAC, security  |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)                 | Tokens, components, layouts, motion |
| [docs/CLIENT-CLARIFICATIONS.md](docs/CLIENT-CLARIFICATIONS.md) | Open client questions               |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)                         | Change history                      |
| [docs/brand/README.md](docs/brand/README.md)                   | Logo files, colours, usage rules    |

---

© ASRA Academy. Developed by Marvel's Techworks. All rights reserved.
