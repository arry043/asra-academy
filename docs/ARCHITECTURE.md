# ASRA Academy — System Architecture

| Field   | Value                                                  |
| ------- | ------------------------------------------------------ |
| Version | 0.1.0                                                  |
| Status  | Initial architecture (Phase 01 foundation implemented) |

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
- Design system: Tailwind design tokens (ASRA green/gold) + shadcn/ui components.
- API consumption only through a typed API client (`NEXT_PUBLIC_API_URL`). **No direct database access from the frontend.**
- Client-side form validation with shared Zod schemas (`@asra/validation`) — server re-validates.

## 5. Backend Responsibilities (apps/api)

- REST API under `/api/v1`.
- Authentication (JWT issue/verify, bcrypt hashing) — Phase 03.
- Authorization/RBAC enforcement on every request — Phase 03.
- Business logic in services; persistence in repositories via Prisma.
- Input validation (Zod) at the edge of every route.
- Integration with external providers via adapters.
- Background job producers/workers (Redis + BullMQ) — later phases.

### Backend layering

```
apps/api/src/
├── config/        env parsing (Zod), constants
├── controllers/   HTTP ↔ service translation (no business logic)
├── middleware/    request id, logging, error handler, 404, (auth, rbac later)
├── routes/        route registration, versioned under /api/v1
├── services/      business logic
├── repositories/  data access (Prisma only here)
├── validators/    Zod request schemas
├── utils/         response helpers, AppError, async handler
├── types/         backend-only types
├── lib/           infrastructure clients (prisma, redis)
├── app.ts         Express app composition (testable, no listen)
└── server.ts      process entry: listen + graceful shutdown
```

When business modules arrive (Phase 02+), they will be grouped as `src/modules/<module>/{routes,controller,service,repository,validators}.ts` while the shared layers above remain for cross-cutting code.

## 6. Database Responsibilities

- **PostgreSQL** is the single system of record.
- **Production:** Neon (serverless PostgreSQL). `DATABASE_URL` = pooled connection; `DIRECT_DATABASE_URL` = direct connection for migrations.
- **Local development:** PostgreSQL 17 in Docker (`docker-compose.yml`). Docker PostgreSQL is **never** used for production.
- **Prisma** owns schema and migrations (`apps/api/prisma`). Migrations are committed and applied with `prisma migrate deploy` in production.
- Phase 01 contains **no domain models**; the LMS schema is designed in Phase 02.

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

- The API is the **only** authority that issues and verifies tokens.
- JWT access tokens (short-lived) + refresh tokens (rotated, revocable, stored server-side as hashes) — Phase 03.
- Web app stores tokens in **httpOnly, Secure, SameSite** cookies (Technical Recommendation) — never `localStorage`.
- `JWT_SECRET` supplied only via environment.

### 8.2 Authorization boundary

- RBAC middleware on the API decides access; the frontend only hides UI elements for UX.
- Roles (initial): `STUDENT`, `FACULTY`, `ADMIN`, `SUPER_ADMIN`. Parent/Guardian pending.
- Resource-level checks in services (e.g. faculty ↔ allocated subject, student ↔ enrolment).

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
| Notification: email    | Transactional email                         | Pending                             | `EMAIL_API_KEY`                                |
| Notification: WhatsApp | Enquiry / optional notifications            | Pending                             | `WHATSAPP_API_KEY`                             |
| Notification: in-app   | Stored in PostgreSQL                        | —                                   | —                                              |

Rules: provider selection via configuration; no vendor-specific identifiers leak into domain tables beyond `provider` + `providerRef` columns; webhooks are verified before any state change.

### 8.4 Redis / BullMQ (future role)

Phase 01 only provisions Redis and verifies connectivity. From later phases Redis + BullMQ will handle:

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

| ID      | Decision                                                                                    | Status   |
| ------- | ------------------------------------------------------------------------------------------- | -------- |
| ADR-001 | Modular monolith (single Express app)                                                       | Accepted |
| ADR-002 | npm workspaces monorepo                                                                     | Accepted |
| ADR-003 | PostgreSQL + Prisma; Neon in production, Docker locally                                     | Accepted |
| ADR-004 | REST API with `/api/v1` prefix and uniform envelope                                         | Accepted |
| ADR-005 | JWT auth with bcrypt hashing (Phase 03)                                                     | Accepted |
| ADR-006 | Provider adapters for all external services                                                 | Accepted |
| ADR-007 | Redis + BullMQ for background jobs (later)                                                  | Accepted |
| ADR-008 | Prisma driver adapter (`@prisma/adapter-pg`) for runtime connections (Prisma 7 requirement) | Accepted |
