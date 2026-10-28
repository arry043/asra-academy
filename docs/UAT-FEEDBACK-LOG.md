# ASRA Academy — UAT Feedback Log (PHASE 16)

Version 0.1.0 · 2026-10-28 · Plan: [UAT-PLAN.md](./UAT-PLAN.md) · Test cases: [UAT-TEST-CASES.md](./UAT-TEST-CASES.md) · Engineering defects from QA: [QA-DEFECT-LOG.md](./QA-DEFECT-LOG.md)

> **No feedback has been received.** UAT has not started. Entries are added only when a stakeholder actually reports something.

This log records what **testers report**. Engineering's own assessment is recorded alongside it, so the two never get mixed up:

- **Reported** fields (category and severity as proposed by the reporter) are never edited after the fact.
- **Triage** fields (confirmed category, confirmed severity, decision) are filled in by Marvel's Techworks after reproducing the item.
- A request for new or different behaviour is a **Change Request**, not a Bug, even if it is important. Change Requests are implemented only after the academy's approver accepts their scope.
- If an item is already in the QA defect log (e.g. QA-DEF-07), link it rather than open a duplicate.

## 1. Values

**Category:** `Bug` (does not work as built/agreed) · `Change Request` (new or different behaviour) · `Content Correction` (text, images, data) · `Design Feedback` (look and feel).

**Severity:**

- `P0` Critical — system unusable, serious security incident, major data corruption, or equivalent release-blocking failure.
- `P1` High — core workflow broken or essential business functionality unreliable.
- `P2` Medium — feature issue with a reasonable workaround.
- `P3` Minor — cosmetic issue or low-impact usability concern.

**Status:** `New` → `Reproducing` → `Confirmed` / `Not reproducible` / `Works as designed` → `Approved for fix` / `Awaiting client decision` / `Deferred` / `Rejected (out of scope)` → `Fixed` → `Ready for retest` → `Retest passed` / `Retest failed` → `Closed`.

**Retest result:** `Pass` · `Fail` · `Not retested`.

## 2. Summary

Update as entries are added.

|                           | Bug | Change Request | Content Correction | Design Feedback | Total |
| ------------------------- | --- | -------------- | ------------------ | --------------- | ----- |
| Reported                  | 0   | 0              | 0                  | 0               | 0     |
| Confirmed by engineering  | 0   | —              | —                  | —               | 0     |
| Open                      | 0   | 0              | 0                  | 0               | 0     |
| Closed (client-confirmed) | 0   | 0              | 0                  | 0               | 0     |

Open confirmed bugs by severity: P0 0 · P1 0 · P2 0 · P3 0.

## 3. Register

One row per item; full detail in §4.

| Feedback ID  | Date | Reporter role | Module / route | Reported category | Reported sev. | Confirmed category | Confirmed sev. | Status | Owner | Retest | Client confirmed |
| ------------ | ---- | ------------- | -------------- | ----------------- | ------------- | ------------------ | -------------- | ------ | ----- | ------ | ---------------- |
| _(none yet)_ |      |               |                |                   |               |                    |                |        |       |        |                  |

## 4. Entries

Copy the template for each new item. Number sequentially: `UAT-FB-001`, `UAT-FB-002`, …

### Template

```markdown
### UAT-FB-NNN — <short title>

**Reported (by the tester — do not edit after triage)**

- **Reporter / stakeholder role:** <e.g. Academy admin tester> (name optional)
- **Date reported:** YYYY-MM-DD
- **Test case:** <UAT-XXX-NN, or "exploratory">
- **Module and route:** <e.g. Student › Assignments — /student/assignments>
- **Browser / device:** <e.g. Safari 19, iPhone>
- **Category (proposed):** Bug | Change Request | Content Correction | Design Feedback
- **Severity (proposed):** P0 | P1 | P2 | P3
- **Description:** <what happened, in plain words>
- **Steps to reproduce:**
  1. …
  2. …
- **Expected behaviour:** …
- **Actual behaviour:** …
- **Evidence:** <screenshot / recording file name or link — no passwords or real personal data>

**Triage (by Marvel's Techworks)**

- **Reproduced:** Yes / No / Partly — <date, environment, commit>
- **Confirmed category:** …
- **Confirmed severity:** … (reason if different from proposed)
- **Related items:** <QA-DEF-xx / CLIENT-CLARIFICATIONS ID / other UAT-FB>
- **In scope?** Yes / No — <reference to the Order, a clarification, or "new request">
- **Decision:** Fix before launch | Fix after launch | Awaiting client decision | Won't fix (reason) | Works as designed
- **Decision made by / date:** …
- **Owner:** …
- **Target resolution:** <date or release>

**Resolution**

- **Change made:** <summary; commit reference>
- **Regression test:** <test file / name, or "not applicable" with reason>
- **Redeployed to staging:** <date, commit>
- **Retest result:** Pass | Fail | Not retested — <by whom, date>
- **Client confirmation:** <confirmed by / date>, or "not required"
- **Status:** …
```

_(No entries yet.)_
