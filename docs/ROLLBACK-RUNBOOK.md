# ASRA Academy — Release and Rollback Runbook (PHASE 17)

Version 0.1.0 · 2026-10-28 · Platform: Vercel (projects `asra-academy`, `api-asra-academy`) + Neon

## 1. Release steps

1. **Prerequisites:** PR approved; CI green; `npm test` (API) green locally; migrations reviewed (PRODUCTION-DEPLOYMENT §3); release notes list env changes and whether `db:seed` is needed; release manager available for the monitoring window.
2. **Recovery point:** Neon branch `pre-release-<date>-<commit>` (DATABASE-BACKUP-AND-RECOVERY §3).
3. **Environment changes** (if any) in Vercel **before** merging. Web `NEXT_PUBLIC_*` changes need the new build.
4. **Migrations** (if any, additive): `npm run db:migrate:deploy` (+ `db:seed` if required).
5. **Merge to `main`** → Vercel builds and promotes both projects automatically.
6. **Health + smoke:** PRODUCTION-SMOKE-TESTS §2.
7. **Monitoring window:** 30 minutes actively, then 24 hours on call. Watch Vercel runtime logs (5xx, "PostgreSQL unreachable", "Rate limiter using in-memory fallback"), Admin → Email deliveries, Admin → Payments.

Note the web and API deploy independently. A release that changes the API contract must keep the old web working (or the reverse) during the minute both are building.

## 2. Rollback triggers

Roll back without debate when any of these persists for more than 5 minutes after a release:

- `/api/v1/health/ready` not `up`, or 5xx rate clearly above baseline.
- Sign-in broken for any role.
- Students can see content or data they should not (security/RBAC regression). Roll back immediately and treat it as an incident.
- Payments: confirmed payments not activating enrolments, or webhook signature failures.
- Public site down or showing errors on the home or course pages.

## 3. Application rollback (code)

Vercel keeps previous production deployments. Rolling back is a promotion, not a rebuild:

```bash
vercel rollback --scope arry043s-projects   # interactive; or in the dashboard: Deployments → previous Production → "Instant Rollback"
```

- Roll back **each project separately** (web and API), to deployments built from compatible commits.
- Production deployments as of 2026-10-28: current `d6ca7c7` (13:08 IST); previous production deployments from 3 days earlier (`asra-academy-9xsrk1pni…`, `api-asra-academy-d2hoetosd…`). There is no schema change between them, so either can be promoted against the current database.
- After an Instant Rollback Vercel stops auto-promoting new `main` pushes until a deployment is promoted again. Undo with `vercel promote <deployment>` once fixed.
- Then revert the faulty commit on `main` through a PR (Git write: needs the usual approval), so the next merge does not redeploy it.

**Environment-variable mistakes:** restore the previous value in Vercel and **redeploy** (env changes only apply to new deployments; for web `NEXT_PUBLIC_*` a rebuild is required).

## 4. Database and schema

Rolling back code does **not** undo a migration.

- **Additive migration** (new table/column/index): old code keeps working; roll back code only. Remove the schema later in a new migration if needed.
- **Non-additive migration** (drop/rename/type change): old code may fail. Options: (a) roll forward with a fix (preferred); (b) restore the database to the recovery point **and** deploy the matching code. (b) loses data written since the release — needs approval (DATABASE-BACKUP-AND-RECOVERY §4).
- Prisma has no "down" migrations here. Never hand-edit `_prisma_migrations` or run `migrate reset` in production.

## 5. Communication

| Step                                               | Who                                               |
| -------------------------------------------------- | ------------------------------------------------- |
| Decide rollback                                    | Release manager `<to be named>`                   |
| Execute                                            | Operator `<to be named>`                          |
| Inform academy                                     | Release manager → academy contact `<to be named>` |
| Inform users (if impact)                           | Academy                                           |
| Incident note (what, when, impact, fix, follow-up) | Release manager, within 2 working days            |
