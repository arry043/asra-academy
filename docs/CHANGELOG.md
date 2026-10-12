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

- PHASE 02 — Database & Backend Core.

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
