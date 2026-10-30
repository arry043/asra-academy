# ASRA Academy — Release Log (PHASE 18)

Version 0.1.0 · 2026-10-30 · Procedure: [ROLLBACK-RUNBOOK.md](./ROLLBACK-RUNBOOK.md) · Detailed history: [CHANGELOG.md](./CHANGELOG.md)

## Version policy

Semantic versioning, as CHANGELOG.md already states.

| Version  | Meaning                                  |
| -------- | ---------------------------------------- |
| `v1.0.0` | First accepted production release        |
| `v1.0.x` | Backward-compatible fixes                |
| `v1.x.0` | Backward-compatible improvements         |
| `v2.0.0` | Only for a genuinely incompatible change |

**`v1.0.0` has not been released.** Code is running at the production domain, but the Phase 17 gate failed for launch and client acceptance is pending. Calling today's deployment `v1.0.0` would imply an acceptance that has not happened.

No Git tags exist. `package.json` versions (root and web `0.1.1`, API `0.1.0`) were not kept up with the phases and do not identify a release. Identify a deployment by its commit. The release operator creates tags and changes versions.

## Current production

| Field      | Value                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Commit     | `10f4bd1`, confirmed from Vercel metadata for both projects on 2026-10-30                                                     |
| Deployed   | 2026-10-28 14:09 IST. Web `dpl_C4Tz6wjDHkwhkFjkR7c56qEgL7dd`, API `dpl_BD3dq2xns2QrUPDw7m7UH1xgLFT2`                          |
| Difference | Documentation only since `d6ca7c7`, the deployment recorded in Phase 17. Its smoke results therefore still describe this code |
| Status     | Pre-launch, unversioned                                                                                                       |

## Prepared, not released

### Readiness fix — no version assigned

If deployed before launch it needs no version number and becomes part of `v1.0.0`. If deployed after launch, it is `v1.0.1`.

| Field                   | Value                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date                    | Prepared 2026-10-30. **Not deployed, not committed**                                                                                                          |
| Summary                 | `GET /api/v1/health/ready` no longer reports Redis down on the first request to a new function instance                                                       |
| Defects fixed           | INC-2026-001 (P3)                                                                                                                                             |
| Security impact         | None intended. The endpoint is public, but the wait is bounded at 2 s and repeated checks add no listeners (tested). Response still shows only `up` or `down` |
| Database migration      | None                                                                                                                                                          |
| Configuration changes   | None                                                                                                                                                          |
| Test evidence           | See [POST-LAUNCH-REPORT.md](./POST-LAUNCH-REPORT.md) §6. Staging validation **not done**: no staging environment exists                                       |
| Rollback considerations | API project only: Vercel Instant Rollback (ROLLBACK-RUNBOOK §3). No schema or data change. The web app does not depend on it                                  |
| Approval                | **Pending** release manager                                                                                                                                   |

Also ready to merge with it, with no effect on the deployed application: `scripts/production-probe.mjs`, `.github/workflows/production-probe.yml`, documentation.

**Merging to `main` deploys both Vercel projects automatically**, so the merge is the release and needs the approval above.

**After deploying:**

1. Run PRODUCTION-SMOKE-TESTS §2.
2. Retest as described in INC-2026-001.
3. Trigger the workflow once from the Actions tab and confirm the owner can see the run. To test the notification itself, check that the owner receives one on a failed run.
4. Update this log.

## Released

_(None. Add a record here for each production release, using the fields above.)_
