# Notifications (PHASE 11)

Two channels: **in-app** (PostgreSQL, `/api/v1/notifications`) and **email** (Resend, through the existing `emailService`). WhatsApp, SMS and push are out of scope; no adapter, credential or setting exists for them.

## 1. Architecture

```
Business event (inside its own DB transaction)
  └─ notificationProducers.<event>(tx, id)      decides recipients from the database
       └─ notifyUsers(tx, userIds, spec)        one `notifications` row per recipient (in-app)
            └─ + one `notification_deliveries` row (EMAIL) when the event is emailed (outbox)
COMMIT
  └─ dispatchAfterCommit(deliveryIds)           sends right away, without delaying the response
       └─ deliverEmail(id): claim → render → emailService.sendNotification → ACCEPTED/RETRY/FAILED/SKIPPED
Sweep worker (long-running server, every 30 s) retries due deliveries
```

| Concern                                               | Where                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Event catalogue (wording, link, dedupe key, channels) | `src/modules/notifications/events.ts`                          |
| Recipient selection per event                         | `src/modules/notifications/producers.ts`, `eligibleStudentIds` |
| In-app persistence & inbox API                        | `notifications.service.ts`, `notifications.routes.ts`          |
| Email rendering                                       | `email-content.ts` + branded layout `src/email/templates.ts`   |
| Delivery, retries, worker                             | `dispatcher.ts`                                                |
| Provider                                              | `src/email/transports.ts` (Resend), unchanged contract         |

Adding a channel later = a new `notification_channel` value and a sender in the dispatcher; business modules do not change.

**Transactional outbox.** Notifications are written in the same transaction as the business change, so a committed event always has its notification and a rolled-back one never does. Emails are sent only after commit and are never sent from React components.

## 2. Data

- `notifications`: recipient, `type` (REGISTRATION, ENROLLMENT, PAYMENT, LIVE_CLASS, ASSIGNMENT, EXAMINATION, RESULT, CERTIFICATE, ANNOUNCEMENT), `event` (e.g. `live_class.cancelled`), title, plain-text message, optional app-relative `action_url` (CHECK: starts with `/`, never `//`), optional resource reference, non-sensitive `data` for the email, `read_at`, `created_at`. `UNIQUE(user_id, dedupe_key)`.
- `notification_deliveries`: one per notification and channel; `status` PENDING → SENDING → ACCEPTED | FAILED | SKIPPED, `attempts`, `next_attempt_at`, `claimed_at`, `provider_message_id`, `accepted_at`, `last_error` (error class/code only).

## 3. Events and channels

| Event (`event`)                             | Trigger (canonical source)                                                                                 | Recipients                                                   | In-app |                     Email                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | :----: | :--------------------------------------------: |
| Registration `registration.welcome`         | Email address verified (`emailVerificationService.verify`, first time)                                     | The student                                                  |   ✓    |                       ✓                        |
| Enrolment `enrollment.activated`            | FREE self-enrolment or ADMIN enrolment committed ACTIVE, course PUBLISHED                                  | The student                                                  |   ✓    |                       ✓                        |
| Payment `payment.received`                  | Order moved to PAID by `applyProviderPayment` (verified provider data only)                                | The student                                                  |   ✓    | existing payment-confirmation email (PHASE 10) |
| Refund `payment.refund_processed`           | Refund recorded PROCESSED by `applyProviderRefund`                                                         | The student                                                  |   ✓    |        existing refund email (PHASE 10)        |
| Live class `live_class.scheduled`           | Class created                                                                                              | Eligible students; host faculty if someone else scheduled it |   ✓    |                       ✓                        |
| Live class `live_class.updated`             | Time/duration/zone changed, or a joining link added/changed                                                | Eligible students; host if changed by someone else           |   ✓    |                       ✓                        |
| Live class `live_class.cancelled`           | Class cancelled                                                                                            | Eligible students; host if cancelled by someone else         |   ✓    |                       ✓                        |
| Live class `live_class.recording_available` | Recording link added or replaced                                                                           | Eligible students                                            |   ✓    |                       —                        |
| Assignment `assignment.published`           | ASSIGNMENT lesson first becomes PUBLISHED in a PUBLISHED course (faculty create, curriculum create/update) | Eligible students                                            |   ✓    |                       ✓                        |
| Result `result.assignment_released`         | Graded submission released                                                                                 | That student                                                 |   ✓    |                       ✓                        |
| Examination `examination.published`         | Exam published (first publication)                                                                         | Eligible students                                            |   ✓    |                       ✓                        |
| Result `result.exam_published`              | Exam results published                                                                                     | Students who attempted it and can still access the course    |   ✓    |                       ✓                        |
| Result `result.quiz_published`              | Quiz results published by faculty                                                                          | Students who attempted it and can still access the course    |   ✓    |                       ✓                        |

"Eligible students" = ACTIVE enrolment + PUBLISHED course + ACTIVE account — the student-portal entitlement. Recipients are always read from the database, never from a request.

**Not integrated (no source workflow exists):**

- **Certificate** — certificates are not issued by the platform yet (L-01/L-02). The type exists in the catalogue; nothing creates it.
- **Announcement** — there is no announcement feature, and who may send them is pending (O-04). Nothing creates it.
- Assignment **due-date reminders**, **class reminders** — need scheduled jobs (§7).
- A PAYMENT enrolment does not add a separate "enrolled" message: the payment notification already says the enrolment is active (one message per purchase).
- Already-published assignments in a course that is published later are not announced (only the lesson's own publication is an event).

## 4. Duplicate prevention

- Each event builds a deterministic `dedupe_key` (e.g. `live_class.cancelled:<id>`, `payment.received:<orderId>`, `enrollment.activated:<enrollmentId>:<enrolledAt>`); inserts skip existing `(user, key)` rows, so webhook replays, reconciliation passes, repeated clicks and retried requests never create a second notification or email.
- Live-class updates notify only when something students need changed; an identical repeated PATCH changes nothing and notifies no one. Each real change is its own occurrence (key includes the new `updated_at`).
- Payment and refund emails remain the PHASE 10 exactly-once emails; Phase 11 adds only the in-app record.

## 5. Email (Resend)

- Same configuration as before: `EMAIL_TRANSPORT=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` on a domain verified in Resend (Q-02). No new variables.
- One branded layout (ASRA green/gold, escaped values, plain-text alternative always included). Inputs are validated with Zod; links must be absolute http(s).
- Emails are rendered **when sent**: a live-class email shows the class's current time and link; a "scheduled"/"updated" email for a class that has since been cancelled or has ended is **skipped**.
- Each send carries a Resend **idempotency key** (`notification-delivery/<deliveryId>`), so a retried or reclaimed send is not delivered twice within Resend's 24-hour key window.
- Logs and `last_error` contain only error classes/codes and HTTP status — never addresses, message bodies, links or keys.

## 6. Delivery and retries

| Outcome    | When                                                                 | Next                                                                                                    |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ACCEPTED` | Resend accepted the message; its email id is stored                  | Done. **Accepted ≠ delivered**: inbox delivery, bounces and spam placement are not tracked (no webhook) |
| retry      | Timeout, network error, 429, 5xx, 401/403 (config can be fixed)      | `PENDING`, `next_attempt_at = now + attempts² minutes`                                                  |
| `FAILED`   | 400/422 from Resend (invalid request/recipient) or 5 attempts used   | Terminal; visible in the database                                                                       |
| `SKIPPED`  | Recipient account not ACTIVE, or the message is no longer applicable | Terminal                                                                                                |

- A delivery is **claimed** with a conditional UPDATE before sending (one sender only); a `SENDING` claim older than 5 minutes (crashed process) is taken over.
- Retrying a delivery only re-sends an email; it never repeats the business operation.
- The sweep runs every 30 s in `server.ts` (long-running deployments). **Serverless deployments do not run it**: emails go out right after the event, and a failed one stays `PENDING` until a long-running process sweeps it. A scheduled trigger (cron calling a sweep endpoint) would be needed there — not built, as no deployment decision requires it yet (W-items).
- Redis/BullMQ is **not** used: the project has no BullMQ setup and its established background pattern is PostgreSQL-backed sweeps (attempt expiry, payment reconciliation). The outbox gives durable, restart-safe retries without a new queue.
- Provider webhooks for delivery/bounce status are not implemented (not needed for correctness; would need signature verification and a public endpoint).

## 7. Reminders (deferred)

Reminders before a class or an assignment deadline are **not** implemented in this release. Doing them correctly needs a reliable scheduler on the production deployment (serverless has none configured), cancellation when the class moves or is cancelled, and per-occurrence duplicate prevention. The outbox (`next_attempt_at`) can carry scheduled sends later; the decision on timing (e.g. 24 h / 1 h before) is pending (AE-05).

## 8. Inbox API (`/api/v1/notifications`, any signed-in role)

| Method & path       | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `GET /?status=all   | unread&page&pageSize`                        | Newest first, paginated |
| `GET /unread-count` | `{ unread }`                                 |
| `POST /:id/read`    | Idempotent; another user's id → 404          |
| `POST /read-all`    | Marks the caller's unread notifications read |

Every query is scoped to `req.auth.userId`; responses are `no-store`.

## 9. UI

- Bell with unread badge in the header of the student, faculty and admin portals (refreshes every minute, on tab focus and after reading). It links to `/{portal}/notifications`.
- Notifications page: All/Unread tabs, pagination, "Mark all as read", per-item "Open" (same-site paths only) and "Mark as read", loading/empty/error states.
