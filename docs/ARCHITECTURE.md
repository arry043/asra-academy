# ASRA Academy — System Architecture

| Field   | Value                                 |
| ------- | ------------------------------------- |
| Version | 0.1.0                                 |
| Status  | Phase 06 academic & course management |

---

## 1. Architectural Style: Modular Monolith

The backend is **one Express.js application** organised into internal modules. There are **no microservices**.

### Why a modular monolith

| Concern              | Rationale                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Team size & velocity | One codebase, one deployment, one debugger session — fastest path for a small team                                              |
| Transactions         | Enrolment + payment + progress changes need ACID transactions in one PostgreSQL database                                        |
| Operational cost     | One API service to host, monitor and secure                                                                                     |
| Uncertain domain     | Many client decisions are pending; module boundaries can change cheaply inside one process                                      |
| Future extraction    | Clear module boundaries and adapter interfaces allow later extraction (e.g. notifications, media processing) if load demands it |

### Module rules (apply from Phase 02 onward)

1. Each module owns its routes, controller, service, repository and validators.
2. Modules communicate through **service interfaces**, not by reaching into another module's repository.
3. Only repositories talk to Prisma.
4. External providers are only reached via **adapters** (§8).

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser (mobile / tablet / desktop)                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────────────┐
│ apps/web — Next.js (App Router, TypeScript, Tailwind, shadcn/ui)     │
│   Public website (SSR/SSG, SEO) · Student · Faculty · Admin UIs      │
│   TanStack Query (later) for API state                               │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ REST / JSON  — /api/v1/*
┌──────────────────────────────▼───────────────────────────────────────┐
│ apps/api — Express.js (TypeScript) modular monolith                  │
│   Middleware: helmet · cors · request id · logging · auth · rbac     │
│   Routes → Controllers → Services → Repositories                     │
│                 │              │                                     │
│                 │              └── Adapters: payment · live class ·  │
│                 │                  storage · email · WhatsApp        │
│                 ▼                                                    │
│              Prisma ORM                                              │
└────────┬─────────────────────────────────────────┬───────────────────┘
         │                                         │
┌────────▼─────────────────────┐   ┌───────────────▼──────────────────┐
│ PostgreSQL                   │   │ Redis (+ BullMQ, later phases)   │
│  Production: Neon            │   │  Local: Docker                   │
│  Local: Docker               │   │  Production: provider TBD        │
└──────────────────────────────┘   └──────────────────────────────────┘
```

Request flow: **Browser → Next.js → REST API → Express.js → Service layer → Prisma → PostgreSQL / Neon**.

## 3. Repository Layout (npm workspaces monorepo)

```
asra-academy/
├── apps/
│   ├── web/              Next.js frontend
│   └── api/              Express.js backend + Prisma
├── packages/
│   ├── types/            Shared TypeScript types (API envelope, roles)
│   ├── validation/       Shared Zod schemas
│   └── config/           Shared TS config + ESLint config
├── infrastructure/
│   └── docker/           Docker init scripts / notes
├── docs/                 PRD, SRS, architecture, requirements, clarifications
├── .github/workflows/    CI
└── docker-compose.yml    Local PostgreSQL + Redis
```

## 4. Frontend Responsibilities (apps/web)

- Public website: server-rendered/static pages for SEO; metadata, sitemap, robots.
- Student, Faculty and Admin portals (later phases) under role-protected route groups.
- Design system: Tailwind design tokens (ASRA green/gold) + shadcn/ui components — see [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).
- API consumption only through a typed API client (`NEXT_PUBLIC_API_URL`). **No direct database access from the frontend.**
- Client-side form validation with shared Zod schemas (`@asra/validation`) — server re-validates.

### 4.1 Frontend structure (Phase 04, public website added in Phase 05)

```
apps/web/src/
├── app/
│   ├── (public)/               Public website (Phase 05): layout (Navbar + main + Footer), template
│   │                           (page transition), error boundary, home (_home/sections), about,
│   │                           courses (+ [slug] special courses), classes/[band], faculty, admission,
│   │                           contact, blog, privacy-policy, terms, refund-policy — see PUBLIC-WEBSITE.md
│   ├── sitemap.ts, robots.ts   Generated from lib/sitemap + SITE_INDEXING_ENABLED
│   ├── (auth)/                 Login, register, password and email flows (AuthProvider here and in (admin))
│   ├── (admin)/admin/          Admin portal (Phase 06): academic structure, categories, courses, curriculum —
│   │                           client pages over /api/v1/admin, guarded by AdminShell (UI only; API enforces)
│   ├── (internal)/design-system/  Internal showcase + dashboard/admin layout previews (404 in production
│   │                              unless ENABLE_DESIGN_SYSTEM=true; demo fixtures only)
│   ├── globals.css             Design tokens (colour, type roles, spacing, radius, elevation, motion)
│   └── layout.tsx              Fonts (next/font), metadata, <Toaster/>
├── components/
│   ├── ui/                     Core primitives (shadcn/ui style on radix-ui)
│   ├── asra/                   Education cards: courses, faculty, features, categories, testimonials,
│   │                           live-classes, assignments, exams, progress (+ shared card parts)
│   ├── layout/                 Container, Section, Navbar, Footer, Sidebar, DashboardLayout, AdminLayout,
│   │                           PageHeader, BrandMark, SkipLink, PageTransition
│   ├── auth/                   Auth-form adapters over the primitives
│   ├── admin/                  Admin portal screens, useAdminApi/useApiResource data hooks (Phase 06)
│   └── public/                 Public-site blocks: PageHero, CtaBand, EmptyState, ProgrammeGrid,
│                               ProgrammePage, CourseDirectory, ContactForm, LegalPage, WhatsAppLink, JsonLd
├── config/                     siteConfig (confirmed brand/contact), navigation (public routes)
├── content/                    Typed public content (programmes, legal outlines) and the empty-until-
│                               approved lists (faculty, testimonials, live classes, blog)
├── lib/                        api client, env, format (dates in Asia/Kolkata), pagination, navigation,
│                               feature-flags, utils (cn with token-aware tailwind-merge), programmes
│                               (search/filter), seo, sitemap, whatsapp, enquiry
└── types/education.ts          Presentational view models for education components
```

Rules:

- **Server Components by default.** Client boundaries are leaf primitives (Radix wrappers), `Navbar`, `Sidebar` and the `DashboardLayout` shell. Page content passed as `children` stays server-rendered.
- **Presentational components take view models**, not database rows. Pages map API responses into `types/education.ts` shapes. Components never fetch.
- **Layouts are not access control.** Portal and admin routes are protected by the auth/RBAC layer (§8.1–8.2).
- **Dates** use an explicit time zone so server and client render identically.
- **Tests**: `apps/web/tests` (Node test runner + tsx) assert component contracts on server-rendered markup. Interactive behaviour was verified in a real browser during Phase 04 (DESIGN-SYSTEM.md §12).
- **Public pages need no session (Phase 05).** The `(public)` layout has no auth provider. Public pages are prerendered (static) except `/contact` (reads `?topic=`) and, since Phase 06, `/courses` and `/courses/[slug]`, which read published courses from the anonymous `GET /api/v1/courses` endpoints per request (so unpublishing is immediate).
- **Public content is a replaceable data source.** Programme pages still read typed modules in `content/` (programme facts from the Project Development Order only); real courses come from the public catalogue API (`lib/catalog.ts`). See [PUBLIC-WEBSITE.md](./PUBLIC-WEBSITE.md) §6 and [COURSE-MANAGEMENT.md](./COURSE-MANAGEMENT.md) §5.

## 5. Backend Responsibilities (apps/api)

- REST API under `/api/v1`.
- Authentication (JWT access tokens, rotating refresh sessions, Argon2id hashing) — implemented in Phase 03, see [AUTHENTICATION.md](./AUTHENTICATION.md).
- Authorization/RBAC enforcement (`authenticate`, `requireRole`, `requirePermission`, `accessPolicy`) — Phase 03.
- Business logic in services; persistence in repositories via Prisma.
- Input validation (Zod) at the edge of every route.
- Integration with external providers via adapters.
- Background job producers/workers (Redis + BullMQ) — later phases.

### Backend layering

```
apps/api/src/
├── config/        env parsing (Zod), constants
├── controllers/   HTTP ↔ service translation (no business logic)
├── middleware/    request id, logging, error handler, 404, validateRequest, authenticate,
│                  authorize (requireRole/requirePermission), rate-limit, trusted-origin
├── routes/        route registration, versioned under /api/v1
├── services/      business logic
├── repositories/  data access (Prisma only here)
├── validators/    Zod request schemas
├── utils/         response helpers, AppError, async handler
├── types/         backend-only types
├── database/      Prisma client + lifecycle, Prisma→API error mapping, seed modules
├── email/         provider-neutral email service + dev/test transports
├── lib/           infrastructure clients (redis, logger)
├── app.ts         Express app composition (testable, no listen)
└── server.ts      process entry: listen + graceful shutdown
```

Business modules live in `src/modules/<module>/` (Phase 06: `academics`, `courses`, `curriculum`, plus `shared` route/controller helpers), each with its own routes, controller, service and repository; request schemas are shared from `@asra/validation`. The shared layers above remain for cross-cutting code. Admin routers are mounted under `/api/v1/admin` behind `authenticate`, and **each route** requires its own permission, so routers mounted side by side never apply each other's requirements. The curriculum module calls the courses module only through `coursePublicationGuard` (a service interface).

## 6. Database Responsibilities

- **PostgreSQL** is the single system of record.
- **Production:** Neon (serverless PostgreSQL). `DATABASE_URL` = pooled connection; `DIRECT_DATABASE_URL` = direct connection for migrations.
- **Local development:** PostgreSQL 17 in Docker (`docker-compose.yml`). Docker PostgreSQL is **never** used for production.
- **Prisma** owns schema and migrations (`apps/api/prisma`). Migrations are committed and applied with `prisma migrate deploy` in production.
- Phase 02 implemented the initial relational model, the migration, the seed and the reset workflow. Full detail: [DATABASE.md](./DATABASE.md).

### 6.1 Request flow and data access (Phase 02)

```
HTTP request → Router → Middleware (request id, logging, validateRequest/Zod; auth/RBAC in Phase 03)
  → Controller (HTTP in/out only) → Service (business rules, transactions)
  → Repository (only layer using Prisma) → PostgreSQL
Errors → central errorHandler: AppError | ZodError → 422 | Prisma error → 409/404/422/503 (safe messages)
```

- Repositories are factories over a `DbClient` (`PrismaClient` or a transaction client). A service can therefore run several repository calls inside a single `prisma.$transaction`.
- Health endpoints are a deliberate lightweight exception and call `pingDatabase()` directly.

### 6.2 Prisma client lifecycle

- There is **one** `PrismaClient` per process (`src/database/prisma.ts`), backed by a `pg` pool through `@prisma/adapter-pg`. The pool size comes from `DATABASE_POOL_MAX` (default 10).
- `tsx watch` restarts the whole process on change, so no `globalThis` caching is needed.
- On startup, `SELECT 1` is run once. If it fails, a safe log line (error class and code only) is written and the API keeps serving: liveness stays 200, while `/health/ready` and database-backed requests return 503 until the database is reachable.
- On SIGINT/SIGTERM, the HTTP server closes first, then the Prisma pool and Redis disconnect.
- Migrations are **never** run at startup. Production applies them with `npm run db:migrate:deploy`, as a deliberate deployment step.

## 7. API Layer

- Style: REST, JSON, versioned prefix `/api/v1`.
- Success envelope:

```json
{ "success": true, "message": "…", "data": {} }
```

- Error envelope:

```json
{ "success": false, "message": "…", "error": { "code": "NOT_FOUND", "details": [] } }
```

- Every response carries an `X-Request-Id` header for tracing.
- Health endpoints:
  - `GET /api/v1/health` — liveness (process is up).
  - `GET /api/v1/health/ready` — readiness (PostgreSQL and Redis reachable).

## 8. Boundaries and Abstractions

### 8.1 Authentication boundary

Implemented in Phase 03 — full detail in [AUTHENTICATION.md](./AUTHENTICATION.md).

- The API is the **only** authority that issues and verifies tokens.
- **Access token:** JWT HS256 (`jose`), 15 min, claims `sub` + `sid` (session id) only. Sent as `Authorization: Bearer`; the web app keeps it **in memory only** (never localStorage/sessionStorage).
- **Refresh token:** opaque 256-bit value in an **HttpOnly, SameSite=Strict, Secure (prod)** cookie scoped to `/api/v1/auth`; **rotated on every use**; only its SHA-256 hash is stored (`auth_sessions`); reuse of a rotated token revokes the session.
- `authenticate` loads session + user + roles + permissions from PostgreSQL in one query per request, so logout, password reset, suspension and role changes take effect immediately — no token blacklist.
- Passwords: Argon2id. One-time email tokens (verification, reset): random, hashed, single-use, delivered in the URL fragment.
- CSRF: SameSite=Strict + `Origin`/`Sec-Fetch-Site` allow-list on auth routes; other routes use Bearer tokens. Deployment assumption: web and API are same-site.
- `JWT_SECRET` (≥ 32 chars) supplied only via environment; validated at startup.

```
login ──► Argon2id verify ──► auth_sessions row ──► { accessToken } + Set-Cookie asra_refresh
request ──► authenticate (JWT ✓ → session live? user ACTIVE? roles/perms) ──► requireRole/Permission ──► service (accessPolicy ownership)
refresh ──► hash(cookie) → CAS rotate token → new access token + new cookie   (reuse ⇒ revoke session)
```

### 8.2 Authorization boundary

- RBAC middleware on the API decides access (`requireRole` = any-of, `requirePermission` = all-of; 401 unauthenticated vs 403 forbidden); the frontend only hides UI elements for UX.
- Roles (initial): `STUDENT`, `FACULTY`, `ADMIN`, `SUPER_ADMIN` — rows in `roles`, least-privilege grants in `role_permissions`. Parent/Guardian pending.
- **Resource-level checks in services are mandatory** for every business endpoint, via `accessPolicy` (e.g. faculty ↔ assigned course — implemented; student ↔ enrolment — Phase 10). Role middleware alone never enforces ownership.
- Public registration creates STUDENT only; staff accounts are provisioned by an operator CLI (`npm run auth:create-user`) until the admin portal exists.

### 8.3 External service boundary

All third-party providers sit behind interfaces in the API. Business services depend on the interface, never on a vendor SDK.

```ts
// Illustrative interfaces — implemented in the relevant later phases.
interface StorageProvider {
  upload(input: {
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
  }): Promise<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

interface PaymentProvider {
  createOrder(input: {
    amountMinor: number;
    currency: string;
    reference: string;
  }): Promise<{ providerOrderId: string }>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  refund(input: {
    providerPaymentId: string;
    amountMinor?: number;
  }): Promise<{ providerRefundId: string }>;
}

interface LiveClassProvider {
  createMeeting(input: {
    title: string;
    startsAt: Date;
    durationMinutes: number;
  }): Promise<{ meetingId: string; joinUrl: string; hostUrl?: string }>;
  cancelMeeting(meetingId: string): Promise<void>;
}

interface NotificationChannel {
  send(input: { to: string; template: string; data: Record<string, unknown> }): Promise<void>;
}
```

| Abstraction            | Purpose                                     | Provider status                     | Env vars                                       |
| ---------------------- | ------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| Storage                | Lectures, notes, PDFs, submissions, avatars | Pending (S3-compatible recommended) | `STORAGE_URL`, `STORAGE_KEY`, `STORAGE_SECRET` |
| Payment                | Paid course checkout, refunds, webhooks     | Pending                             | `PAYMENT_KEY`, `PAYMENT_SECRET`                |
| Live class             | Meeting create/cancel/join links            | Pending                             | Added when provider chosen                     |
| Notification: email    | Transactional email                         | Resend (`EMAIL_TRANSPORT=resend`)   | `EMAIL_API_KEY`, `EMAIL_FROM`                  |
| Notification: WhatsApp | Enquiry / optional notifications            | Pending                             | `WHATSAPP_API_KEY`                             |
| Notification: in-app   | Stored in PostgreSQL                        | —                                   | —                                              |

Rules: provider selection via configuration; no vendor-specific identifiers leak into domain tables beyond `provider` + `providerRef` columns; webhooks are verified before any state change.

### 8.4 Redis / BullMQ (future role)

Since Phase 03 Redis stores the shared **auth rate-limit counters** (with an in-memory fallback if Redis is down). From later phases Redis + BullMQ will handle:

- Email/WhatsApp notification delivery with retries.
- Scheduled reminders (live classes, deadlines).
- Certificate PDF generation.
- Report generation/exports.
- Optional caching and rate-limit counters.

Workers will run as a separate **process** of the same codebase (`apps/api`), not a separate service — still a modular monolith.

## 9. Environments

| Environment         | Web                | API                 | PostgreSQL                                                    | Redis                   |
| ------------------- | ------------------ | ------------------- | ------------------------------------------------------------- | ----------------------- |
| Local               | `next dev` on host | `tsx watch` on host | Docker `postgres:17-alpine`                                   | Docker `redis:7-alpine` |
| CI                  | build only         | build + typecheck   | not required (Prisma validate/generate use a placeholder URL) | not required            |
| Development/Staging | Hosting pending    | Hosting pending     | Neon branch                                                   | Provider pending        |
| Production          | Hosting pending    | Hosting pending     | Neon (main branch)                                            | Provider pending        |

Hosting targets for web and API are pending (CLIENT-CLARIFICATIONS §W).

## 10. Configuration & Secrets

- Root `.env.example` documents every variable and which environment needs it.
- API validates its environment with Zod at startup and **fails fast** on invalid config.
- Only `NEXT_PUBLIC_*` variables are exposed to the browser.
- No secrets are committed; `.env*` files (except `.env.example`) are git-ignored.

## 11. Cross-Cutting Concerns

| Concern          | Approach                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| Logging          | Structured JSON logs (pino) with request id; pretty output in development              |
| Errors           | `AppError` + central error handler; consistent envelope; no stack traces in production |
| Security headers | Helmet                                                                                 |
| CORS             | Allow-list from `CORS_ORIGINS` (defaults to `NEXT_PUBLIC_APP_URL`)                     |
| Validation       | Zod at API boundaries; shared schemas in `@asra/validation`                            |
| Shutdown         | SIGINT/SIGTERM → stop accepting connections → close Prisma + Redis → exit              |
| Code quality     | TypeScript strict, ESLint, Prettier, Husky + lint-staged, CI                           |

## 12. Future Extensibility

- **Academic structure:** data-driven Program → Class/Category → Course/Subject → Chapter → Lesson hierarchy so new classes, streams, boards and special courses need no code changes.
- **Providers:** swap/add payment, live-class, storage, email and WhatsApp providers by adding an adapter.
- **Localisation:** Next.js i18n routing can be added for Hindi/Urdu/Arabic UI (RTL for Urdu/Arabic) if confirmed.
- **Mobile app:** the versioned REST API can serve a future mobile client.
- **Scale-out:** stateless API behind a load balancer; workers scale independently; media via CDN; Neon read replicas if needed; extraction of high-load modules into services only when metrics justify it.

## 13. Architecture Decision Log

| ID      | Decision                                                                                                                            | Status   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ADR-001 | Modular monolith (single Express app)                                                                                               | Accepted |
| ADR-002 | npm workspaces monorepo                                                                                                             | Accepted |
| ADR-003 | PostgreSQL + Prisma; Neon in production, Docker locally                                                                             | Accepted |
| ADR-004 | REST API with `/api/v1` prefix and uniform envelope                                                                                 | Accepted |
| ADR-005 | JWT access tokens + rotating refresh sessions; **Argon2id** hashing (supersedes bcrypt, Phase 03)                                   | Accepted |
| ADR-006 | Provider adapters for all external services                                                                                         | Accepted |
| ADR-007 | Redis + BullMQ for background jobs (later)                                                                                          | Accepted |
| ADR-008 | Prisma driver adapter (`@prisma/adapter-pg`) for runtime connections (Prisma 7 requirement)                                         | Accepted |
| ADR-009 | UUID keys generated by PostgreSQL (`gen_random_uuid()`); snake_case tables/columns                                                  | Accepted |
| ADR-010 | Roles/permissions as data with many-to-many user roles (pending S-04)                                                               | Accepted |
| ADR-011 | Hand-written CHECK constraints in migration SQL for invariants Prisma cannot express                                                | Accepted |
| ADR-012 | Node built-in test runner + tsx against a local `*_test` database (no new dependencies)                                             | Accepted |
| ADR-013 | Access token in memory + refresh token in HttpOnly SameSite=Strict cookie; same-site deployment                                     | Accepted |
| ADR-014 | Authorization from database state on every request (session-bound JWT `sid`), no blacklist                                          | Accepted |
| ADR-015 | Redis-backed rate limiting with per-instance memory fallback                                                                        | Accepted |
| ADR-016 | Design tokens as CSS variables in `globals.css` (Tailwind v4 `@theme`), semantic names over raw colours                             | Accepted |
| ADR-017 | UI primitives on the existing `radix-ui` package (incl. Radix Toast); no extra UI/animation libraries                               | Accepted |
| ADR-018 | CSS-only motion (transitions, keyframes, scroll-driven reveal) with `prefers-reduced-motion` support                                | Accepted |
| ADR-019 | Internal showcase gated server-side per request (`ENABLE_DESIGN_SYSTEM`), 404 in production by default                              | Accepted |
| ADR-020 | Web tests reuse ADR-012 (Node test runner + tsx) with server-rendered markup; no jsdom/Jest/Vitest                                  | Accepted |
| ADR-021 | Public catalogue from typed static content until a public course API exists (PHASE 06)                                              | Accepted |
| ADR-022 | No enquiry API yet: contact form validates with the shared schema and hands off to the visitor's email app; never claims delivery   | Accepted |
| ADR-023 | Search indexing opt-in per production build (`SITE_INDEXING_ENABLED`); canonical origin = `NEXT_PUBLIC_APP_URL`                     | Accepted |
| ADR-024 | Course publication status and visibility are separate; public visibility enforced in the API query, hidden = 404 (Phase 06)         | Accepted |
| ADR-025 | Publication rules in one pure function, re-checked after every change to a published course (rollback on violation)                 | Accepted |
| ADR-026 | Course mutations row-lock the course; optional `expectedUpdatedAt` gives optimistic concurrency (409 on stale edits)                | Accepted |
| ADR-027 | Lesson resources are HTTPS references only until a storage provider exists; stored-object locations refused (R-01)                  | Accepted |
| ADR-028 | Admin data hooks over `authorizedRequest` instead of TanStack Query (not yet approved); explicit up/down reordering, no DnD library | Accepted |
| ADR-029 | `/courses` and `/courses/[slug]` render per request (`no-store`, `force-dynamic`) — supersedes the static catalogue part of ADR-021 | Accepted |
