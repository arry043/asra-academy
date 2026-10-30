# ASRA Academy — Incident Response (PHASE 18)

Version 0.1.0 · 2026-10-30 · **Proposed, awaiting approval** · Log: [PRODUCTION-INCIDENT-LOG.md](./PRODUCTION-INCIDENT-LOG.md) · Signals: [POST-LAUNCH-MONITORING.md](./POST-LAUNCH-MONITORING.md) · Rollback: [ROLLBACK-RUNBOOK.md](./ROLLBACK-RUNBOOK.md) · Recovery: [DATABASE-BACKUP-AND-RECOVERY.md](./DATABASE-BACKUP-AND-RECOVERY.md)

The project had no incident policy before this document. The severity scale below reuses the P0–P3 scale from QA and UAT.

## 1. Workflow

```text
Monitor → Detect and collect evidence → Triage severity → Reproduce safely
        → Fix and add regression test → Verify in staging → Approve and deploy patch
        → Monitor and close
```

**Collect evidence first.** Runtime logs last about an hour on the current plan (POST-LAUNCH-MONITORING §2), so save the sanitized fields before doing anything else.

## 2. Severity

| Level | Meaning                                                                                     | Examples for this platform                                                                                           |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P0    | Broad outage, major data corruption, serious security compromise, payment or data emergency | Anonymous access to admin data; students seeing other students' data; payments not activating enrolments at scale    |
| P1    | Core journey unavailable, or a serious defect in important functionality                    | Sign-in broken for a role; lessons will not open; assessment submissions failing; API readiness failing persistently |
| P2    | Limited feature failure with a reasonable workaround                                        | One report failing; emails failing while the in-app notice still works                                               |
| P3    | Minor or cosmetic, low impact                                                               | Wrong plural on a card; a monitoring false alarm with no user effect                                                 |

When unsure between two levels, take the higher one and lower it once there is evidence. Anything involving minors' personal data starts at P0 until scoped.

## 3. Response targets: **not set**

No target is defined, and no 24/7 cover is implied. They cannot responsibly be set yet because the inputs are unknown:

- who is on call, and in what hours (every role below is `<to be named>`);
- what the academy expects, and what its contract with Marvel's Techworks says;
- which hours students use the platform, especially around exams.

Until agreed, incidents are handled in working hours, on a best-effort basis, most severe first. Agree targets before launch: this is a client decision in [POST-LAUNCH-REPORT.md](./POST-LAUNCH-REPORT.md) §8.

## 4. Roles

| Role                   | Does                                        | Person          |
| ---------------------- | ------------------------------------------- | --------------- |
| First responder        | Receives alerts, collects evidence, triages | `<to be named>` |
| Release manager        | Go/no-go, rollback decision, incident note  | `<to be named>` |
| Vercel / Neon operator | Deploy, rollback, recovery                  | `<to be named>` |
| Academy contact (X-05) | Business decisions, user communication      | `<to be named>` |
| Payment account owner  | Razorpay dashboard                          | `<to be named>` |

Escalate first responder → release manager → academy contact. Security or privacy incidents go straight to the release manager and academy contact. Whether the academy has legal notification duties for a personal-data incident is a question for its adviser and is not answered here.

## 5. Critical incidents (P0, and P1 with data risk)

1. **Contain.** Protect data first, restore service second. Use ROLLBACK-RUNBOOK §2–3: Instant Rollback changes no data.
2. **Stop unsafe automation** if it is doing harm and the release manager authorises it, for example by disabling a webhook in the provider's dashboard.
3. **Preserve evidence.** Save sanitized log fields, request IDs, timestamps and the deployment ID before they expire. No personal data, tokens or payment details in the record.
4. **No destructive repairs.** Never `migrate reset`, `db push` or hand-edit `_prisma_migrations`. A manual data change needs explicit authorisation, a written reason and a recovery plan. Take a Neon recovery branch first.
5. **Coordinate with providers.** Vercel, Neon, Redis, Resend and Razorpay issues go through the account owner. Reconcile payments with the Razorpay dashboard before changing any order.
6. **Suspected compromise:** rotate the affected secret (`JWT_SECRET` signs everyone out) and review `AdminAuditLog` and `PaymentAuditLog`. Remember that Preview currently shares production secrets (B1), so assume exposure includes every preview deployment.
7. **Communicate.** The release manager informs the academy contact, and the academy decides what users are told.
8. **Record it.** Add it to the log with the recovery decision, within 2 working days (ROLLBACK-RUNBOOK §5).

## 6. Fixing a confirmed defect

1. Reproduce safely, never with destructive experiments or load tests against production.
2. Identify the affected code and dependency, and find the root cause. Keep confirmed causes and hypotheses visibly apart.
3. Write a regression test.
4. Make the smallest justified fix, without unrelated refactoring.
5. Run relevant unit and integration tests, affected E2E tests, typecheck, lint and production build.
6. Validate in staging. **Staging does not exist yet** ([UAT-ACCESS-SETUP.md](./UAT-ACCESS-SETUP.md)), and today's previews share the production database (B1), so a preview is not a safe test bed.
7. Get approval, then deploy through the normal process (ROLLBACK-RUNBOOK §1).
8. Monitor the fix and record the result.

Security and data-integrity issues take priority over routine release timing.

## 7. Incident record

Copy into the log. Add real incidents only: never fill it with examples or tests.

```markdown
### INC-YYYY-NNN — <short title>

- **Status:** Open | Mitigated | Fixed, not deployed | Monitoring | Closed
- **Severity:** P0–P3 (proposed by / confirmed by)
- **First observed / last observed (UTC):**
- **Affected service and route:**
- **Impacted users or workflow:** <what is known; say "unknown" if so>
- **Evidence:** <sanitized log fields, request IDs, deployment ID>
- **Reproduction:**
- **Root cause:** Confirmed: … / Hypothesis: …
- **Mitigation:**
- **Permanent fix:** <commit>
- **Regression test:**
- **Deployment and retest:** <release, date, result>
- **Follow-up:**
```
