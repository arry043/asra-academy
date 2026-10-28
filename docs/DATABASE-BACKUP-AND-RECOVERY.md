# ASRA Academy — Database Backup and Recovery (PHASE 17)

Version 0.1.0 · 2026-10-28 · Database: Neon PostgreSQL (production), Prisma migrations (`apps/api/prisma/migrations`, 10 applied in history)

## Status: **NOT VERIFIED**

Phase 17 could not inspect the production Neon project. The local Neon CLI session had expired, and the database credentials exist only in Vercel and were deliberately not pulled. Nothing below is claimed as working until the evidence table (§5) is filled in.

Indirect evidence only: production readiness reports `database: up`, and the newest tables (Phase 13 certificates) answer queries. This suggests the migrations are applied. It is **not** a substitute for `npm run db:migrate:status`.

## 1. What Neon offers (confirm against the actual plan)

- **Point-in-time restore (PITR)** within the project's _history retention window_. The window depends on the plan and project setting; it is not assumed here (W-05 expects 7–30 days).
- **Branches**: instant copy-on-write snapshots of a point in time, usable as a recovery point or an isolated restore test.
- **Logical export** (`pg_dump`) as an extra offline copy, only to an approved, access-controlled location (never a laptop's Downloads folder or a shared drive).

## 2. Operator checks (to do once, record in §5)

1. `neon auth` (interactive, operator only), then `neon projects list` — identify the **production** project and its region.
2. Record plan and history-retention setting (Neon console → Project settings → Storage / History retention).
3. Confirm the production branch name and that the Vercel `DATABASE_URL` host matches it. Compare host names only; do not print passwords.
4. `npm run db:migrate:status` with only the production `DIRECT_DATABASE_URL` in the shell environment. Expected: 10 migrations, "Database schema is up to date".
5. Restore drill (isolated): create a branch from a past timestamp, connect a **local** read-only session or a Preview API to it, check row counts of `users`, `courses`, `enrollments`. Then delete the branch. Never restore over production as a test.

## 3. Before every production migration or risky release

1. Create a named branch from production `main` at the current time: `pre-release-<YYYYMMDD>-<commit>`.
2. Record the timestamp (UTC) in the release notes.
3. Apply migrations (PRODUCTION-DEPLOYMENT §3).
4. Keep the branch until the monitoring window ends (≥ 24 h), then delete it (branches count toward storage).

## 4. Recovery procedure

**Decide first:** a code rollback (ROLLBACK-RUNBOOK) fixes most incidents. A database restore loses every write after the restore point (enrolments, payments, submissions), so it needs the release manager's and academy's approval.

1. Stop writes: put the API into an unavailable state (e.g. promote a maintenance deployment, or temporarily remove `DATABASE_URL` from Production and redeploy — readiness then reports down).
2. In Neon, restore the production branch to the chosen point in time (or create a branch at that point and repoint `DATABASE_URL`/`DIRECT_DATABASE_URL` to it).
3. If the restore point is before a migration, deploy the code version that matches that schema (ROLLBACK-RUNBOOK §3).
4. Restore normal configuration, redeploy, run the smoke tests.
5. Reconcile payments made after the restore point with the Razorpay dashboard (orders/payments may exist at Razorpay but not in the DB). Re-enrol affected students manually and record it.
6. Inform affected users through the academy.

## 5. Evidence (fill in — do not mark verified without it)

| Item                            | Value       | Checked by / date |
| ------------------------------- | ----------- | ----------------- |
| Neon project / region           | `<pending>` |                   |
| Plan                            | `<pending>` |                   |
| History retention window        | `<pending>` |                   |
| Production branch               | `<pending>` |                   |
| `db:migrate:status` result      | `<pending>` |                   |
| Pre-launch recovery branch      | `<pending>` |                   |
| Restore drill (isolated) result | `<pending>` |                   |
