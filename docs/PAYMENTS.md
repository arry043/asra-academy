# ASRA Academy — Enrolment & Payment (PHASE 10)

| Field    | Value                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| Version  | 0.10.0                                                                                      |
| Status   | Implemented (uncommitted, pending review). Live mode awaits Razorpay account activation.    |
| Provider | Razorpay (Orders API, Standard Checkout, Payments, Refunds, Webhooks)                       |
| Code     | `apps/api/src/modules/payments/*`, web `components/student/checkout.tsx`, `/admin/payments` |

Paid courses are bought online through Razorpay. The browser never decides a price or a payment outcome: the API computes the price, creates the order, verifies every payment with Razorpay and only then activates the course enrolment. Free courses keep their existing free-enrolment flow (no order, no payment). Open business questions are in [CLIENT-CLARIFICATIONS.md §AD](./CLIENT-CLARIFICATIONS.md).

---

## 1. Flow

```
Course page ── "Enrol now" / "Buy course"
   │  (not signed in → /login?next=/student/checkout/<slug>; registration keeps the path through email verification)
   ▼
GET  /student/checkout/:slug        server: course published? enrolled? price (list − discount)? checkout configured?
POST /student/orders {courseId}     server: re-checks everything, creates/reuses the local Order (price snapshot),
   │                                        creates the Razorpay order with the SERVER amount, returns public checkout data
   ▼
Razorpay Checkout (browser)         student pays (UPI/card/net banking/wallet — handled entirely by Razorpay)
   │ success callback (order id, payment id, signature)
   ▼
POST /student/orders/:id/verify     server: our order? signature valid with THIS order's mode secret?
   │                                        fetch the payment from Razorpay; same order, amount, currency?
   │                                        authorised → capture; captured → applyProviderPayment():
   │                                        Payment CAPTURED + Order PAID + Enrollment ACTIVE (one transaction)
   ▼
Webhook  payment.captured / order.paid … (signed, deduplicated) — same applyProviderPayment(), idempotent
Reconciliation (status check, admin, background sweep)       — same applyProviderPayment(), idempotent
   ▼
Course access (existing accessPolicy: ACTIVE enrolment in a PUBLISHED course)
```

The success callback is not proof of payment. If the browser closes, the connection drops or verification cannot reach Razorpay, the order stays PENDING and is settled by the webhook, by "Check payment status", or by the background sweep.

## 2. Configuration, test mode and live mode

All payment configuration is on the **API**. None of it is `NEXT_PUBLIC_*`: the browser only ever receives the public key id inside a checkout response.

| Variable                                 | Purpose                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RAZORPAY_MODE`                          | `test` or `live`: mode of **new** orders. Empty = online checkout disabled (no fallback to either mode). |
| `RAZORPAY_TEST_KEY_ID`                   | Test key id (`rzp_test_…`).                                                                              |
| `RAZORPAY_TEST_KEY_SECRET`               | Test key secret.                                                                                         |
| `RAZORPAY_TEST_WEBHOOK_SECRET`           | Secret of the **test** webhook.                                                                          |
| `RAZORPAY_LIVE_KEY_ID`                   | Live key id (`rzp_live_…`).                                                                              |
| `RAZORPAY_LIVE_KEY_SECRET`               | Live key secret.                                                                                         |
| `RAZORPAY_LIVE_WEBHOOK_SECRET`           | Secret of the **live** webhook.                                                                          |
| `RAZORPAY_ALLOW_TEST_MODE_IN_PRODUCTION` | `true` only on a staging deployment that runs `NODE_ENV=production` with test mode.                      |
| `PAYMENT_ORDER_TTL_MINUTES`              | Minutes an unpaid order stays open for checkout (default 30, 5–1440).                                    |

Startup validation (`apps/api/src/config/env.ts`) refuses to start when:

- a key id is in the wrong slot (a `rzp_live_` key in `RAZORPAY_TEST_KEY_ID` or vice versa), or a key id is set without its secret;
- the selected mode lacks its key id/secret;
- `RAZORPAY_MODE=live` with `NODE_ENV` other than `production` (development machines and tests cannot take real money);
- in production, the selected mode has no webhook secret, or test mode is selected without `RAZORPAY_ALLOW_TEST_MODE_IN_PRODUCTION=true`.

Validation messages name variables only, never values. Outside production, live keys are ignored entirely, even if present.

**Mode separation.** Each order, payment and refund stores `mode` (TEST/LIVE). Order creation also stores `provider_key_id`. Verification, capture, refunds and reconciliation always use the credentials of the **row's** mode (`paymentsConfig.requireAccount(order.mode)`), never the current `RAZORPAY_MODE`. After a switch from test to live, old test orders can still be settled while the test keys stay configured. Once those keys are removed, the API refuses those orders with 503 rather than verifying them with live keys. A live summary never includes test money.

### 2.1 Test mode setup (local / staging)

1. In the Razorpay Dashboard, switch to **Test Mode** → Account & Settings → **API Keys** → generate a key. Put the id and secret in `RAZORPAY_TEST_KEY_ID` / `RAZORPAY_TEST_KEY_SECRET` and set `RAZORPAY_MODE=test`.
2. **Webhook (test):** Dashboard (Test Mode) → Account & Settings → **Webhooks** → Add:
   - URL: `https://<api-host>/api/v1/payments/webhooks/razorpay/test` (HTTPS on port 443 required; for local development use an HTTPS tunnel to `localhost:4000`).
   - Secret: a long random value; copy it to `RAZORPAY_TEST_WEBHOOK_SECRET`.
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
3. Restart the API. The admin page `/admin/payments` shows "Test mode (active)"; the checkout page shows a "no real money is charged" badge.
4. Pay with Razorpay's test instruments (https://razorpay.com/docs/payments/payments/test-card-details/, test UPI ids and netbanking simulator). Test refunds also work in test mode.

Without a tunnel, local test payments still complete through the Checkout callback and "Check payment status": webhooks are a second path, not a requirement.

### 2.2 Live mode setup (production)

Prerequisites outside the code: the academy's Razorpay account must be **activated** (KYC/business verification), with the desired payment methods enabled and settlement details configured. Code alone does not make live payments operational, and live mode has not been verified with a real payment yet.

1. Dashboard (Live Mode) → API Keys → generate live keys → `RAZORPAY_LIVE_KEY_ID` / `RAZORPAY_LIVE_KEY_SECRET` on the production API only.
2. Live webhook → URL `https://<api-host>/api/v1/payments/webhooks/razorpay/live`, same event list, new secret → `RAZORPAY_LIVE_WEBHOOK_SECRET`.
3. Recommended: Dashboard → Payment Capture → **automatic capture**. The platform also captures authorised payments itself, see §6.
4. Set `RAZORPAY_MODE=live` and deploy. Run `npm run db:migrate:deploy` and `npm run db:seed` first.
5. Make one low-value authorised live purchase and refund it, to confirm the end-to-end setup.

**Switching modes** is a configuration change on the API only. Keep the previous mode's keys configured until `/admin/payments` (mode switch) shows no open orders and no refunds in progress for it.

## 3. Provider boundary

`gateway.ts` defines `PaymentGateway` (create/fetch order, list order payments, fetch/capture payment, create/list refunds). `razorpay.gateway.ts` implements it over Razorpay's documented REST API with HTTP Basic auth, a 10 s timeout and Zod-validated responses.

Errors are classified:

- **REJECTED** (4xx): the request did not happen.
- **AUTH** (401): a configuration error.
- **TIMEOUT / NETWORK / UNAVAILABLE** (5xx/429): the outcome is unknown. Callers never assume success or failure and leave the work to reconciliation.

Provider errors become a generic 503 for clients. The official Node SDK was not added because it wraps the same endpoints, and calling them directly keeps timeouts and validation explicit.

Tests inject `tests/support/razorpay-fake.ts` (an in-memory Razorpay with real HMAC signatures) via the test-only `setPaymentAccountsForTests` (throws outside `NODE_ENV=test`). No test can reach Razorpay.

## 4. Pricing (server-authoritative)

`pricing.ts` is the only price calculation and uses integer paise only.

| Course                     | Result                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `priceMinor` null          | Not buyable online ("contact the academy")                                             |
| `priceMinor` 0             | Free → existing free enrolment (no order, no payment)                                  |
| Discount PERCENTAGE p      | discount = ⌊price × p / 100⌋ (rounded **down**)                                        |
| Discount FIXED_AMOUNT v    | discount = min(v, price)                                                               |
| Payable = price − discount | Must be ≥ ₹1 (Razorpay minimum) and INR (M-03); 0 after discount → not buyable (AD-04) |

The order stores the full snapshot (list price, discount type/value, discount, amount, currency, course title), so later price edits never change an existing order. An open order on old terms is reconciled with Razorpay and then replaced (§5). Request bodies are strict: an amount, currency, status or user id posted by a client is rejected with 422.

## 5. Checkout (student)

Web page: `/student/checkout/[slug]`. Entry points: **Buy course** on the course overview and catalogue, and **Enrol now** on the public course page.

- **Eligibility** (server, every time): course PUBLISHED and not PRIVATE, not already enrolled (409 `ALREADY_ENROLLED`), not a cancelled enrolment (contact the academy, as for free courses), priced and payable, checkout configured.
- **One open order** per student and course (partial unique index). Concurrent requests from two tabs or double clicks resolve to the same order and the same Razorpay order. Resuming checkout reuses the order while the price, mode and window are unchanged.
- **Replacing a stale order** (price changed, window expired, mode switched): the old order is first reconciled with Razorpay. If Razorpay cannot be reached and reuse is impossible, the request fails with 503 instead of risking a double charge.
- **Provider order creation** happens outside the database transaction. If it fails, the local order stays CREATED and the next attempt retries for the **same** local order. If a provider order was created but its id could not be saved, that orphan Razorpay order is never shown to anyone and cannot be paid.
- **UI states:** loading, sign-in redirect, preparing order, Checkout open, confirming, paid and enrolled (with receipt link), failed (with Razorpay's reason, retry on the same order), window closed (not treated as failure; "Check payment status"), being confirmed, network interruption, already enrolled, free course, unavailable, and checkout disabled. Buttons are locked while a request or the Checkout window is active.

## 6. Payment verification

`POST /student/orders/:id/verify` with `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`:

1. The order belongs to the caller (others get 404 — no IDOR).
2. `razorpayOrderId` equals the provider order id **we stored**.
3. HMAC-SHA256(key secret of the **order's mode**, `"<stored order id>|<payment id>"`) equals the signature (constant-time).
4. The payment is **fetched from Razorpay**: same provider order, then amount and currency are compared with the order.
5. An `authorized` payment that matches exactly is **captured** by the platform (uncaptured payments are auto-refunded by Razorpay and never grant access).
6. `applyProviderPayment` records it. Only a **captured**, matching payment marks the order PAID and activates the enrolment.

Failures in steps 2–4 return 400, change nothing and are written to `payment_audit_logs` (`payment.verification_failed`). If Razorpay is unreachable in step 4, the API returns 503 "being confirmed": nothing is activated from the signature alone.

## 7. Webhooks

`POST /api/v1/payments/webhooks/razorpay/test` and `…/live` (a bare `…/razorpay` uses the active mode). The router is mounted in `app.ts` **before** `express.json`, so the HMAC is computed over the exact raw bytes (`express.raw`, `application/json`, 512 kB). It is rate-limited per IP (600/min); a 429 is retried by Razorpay.

1. **Signature first:** `X-Razorpay-Signature` = HMAC-SHA256(webhook secret of the URL's mode, raw body). Missing, malformed or invalid → 400 with no database write.
2. **Dedup:** the `x-razorpay-event-id` header (a SHA-256 of the body if absent) goes into `payment_webhook_events` with UNIQUE(provider, mode, event id). Only a sanitized extract is stored (ids, status, amount, currency, method, error code/description), never email, phone, VPA or card data.
3. **Processing state:** RECEIVED → PROCESSING (claimed with a 2-minute lease, so concurrent duplicate deliveries run side effects once) → PROCESSED / IGNORED, written **after** the changes commit, or FAILED (retried on redelivery).
4. **Events used:**
   - `payment.authorized`, `payment.captured`, `payment.failed` and `order.paid` → `applyProviderPayment`. An authorised payment is captured first.
   - `refund.created`, `refund.processed` and `refund.failed` → `applyProviderRefund`.
   - Other events → IGNORED.
   - Unknown orders, or another integration on the same account → IGNORED.
   - An order of the other mode → IGNORED and audited (`webhook.mode_mismatch`).
5. **Responses:**

   | Status | Meaning                                    |
   | ------ | ------------------------------------------ |
   | 200    | Processed, ignored or duplicate            |
   | 400    | Bad signature or body                      |
   | 404    | Unknown mode                               |
   | 409    | Another delivery is processing the event   |
   | 503    | No webhook secret configured for this mode |
   | 500    | Internal failure                           |

   Every non-2xx response is retried by Razorpay. If you rotate a webhook secret, Razorpay signs retried older events with the old secret. Rotate when no deliveries are failing.

## 8. Payment → enrolment state machine

`core.ts` is the single authoritative service, called by verification, webhooks, reconciliation and admin reconciliation. It runs one short transaction (no provider call inside), locks the order row, and:

- **Payment status is monotonic:** CREATED < FAILED < AUTHORIZED < CAPTURED.
  - CAPTURED is never downgraded.
  - A webhook snapshot only moves forward, so a stale `payment.failed` is ignored after an authorisation or capture. Razorpay documents that a failed payment can later be captured (UPI retry); that capture is accepted.
  - A direct fetch may move AUTHORIZED → FAILED (an expired authorisation that Razorpay returned).
- **Captured + matching + order not PAID:**
  1. Order → PAID.
  2. Enrolment created, or a cancelled one reactivated, with `source = PAYMENT` and `order_id`. This is serialised with the same course-row lock as free and admin enrolment and guarded by UNIQUE(user, course).
  3. `payments.applied_at` is set and the steps are audited.
  4. `justPaid = true` for exactly one caller, which sends the confirmation (§12).
- **Captured but not applied:** the payment row is kept with a `review_reason` and the order is not activated:
  - amount or currency mismatch;
  - a second captured payment for an already-paid order (refund the duplicate);
  - a payment captured while the student was already enrolled through another route.

  These appear under **Needs review** on `/admin/payments`.

- **Late payments:** a captured payment for a CANCELLED or EXPIRED order is honoured, because Razorpay took the money for it. Paid enrolments do not expire (AD-09).
- **Failed attempts:** recorded per attempt. The order stays PENDING, so the student can retry on the same order, and `orders.failure_reason` holds Razorpay's customer-facing description.

## 9. Data model

| Entity                | Responsibility                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Order`               | What was bought, by whom, at which frozen price, in which mode; Razorpay order id; lifecycle; reconciliation/email state |
| `Payment`             | One Razorpay payment (attempt) per row (unique provider id); status, method, safe error, refunded total, review reason   |
| `Enrollment`          | The entitlement (unchanged Phase 07 model) + `source = PAYMENT` and `order_id`                                           |
| `Refund`              | Each refund separately (receipt/idempotency key, provider id, status, requester, `revoked_access`)                       |
| `PaymentWebhookEvent` | Received webhooks and their processing state                                                                             |
| `PaymentAuditLog`     | Append-only financial audit (actor, action, ids/amounts only)                                                            |

Statuses:

- Order: CREATED → PENDING → PAID, or CANCELLED (superseded) / EXPIRED.
- Payment: CREATED / AUTHORIZED / CAPTURED / FAILED.
- Refund: REQUESTED → PENDING → PROCESSED / FAILED.

Constraints are listed in [DATABASE.md §4.2.6](./DATABASE.md). Financial foreign keys are RESTRICT, so history is never deleted when a course is archived or an account is deactivated. Migration: `20261019090000_phase10_enrolment_payment` (additive).

## 10. Reconciliation and recovery

`reconcile.ts` (`reconcileOrder`) lists the order's payments from Razorpay **with the order's mode**, captures matching authorised payments, applies each one, syncs refunds and expires unpaid orders past their window. Triggers:

- **Student "Check payment status"** (`POST /student/orders/:id/refresh`). Each order is read from Razorpay at most once every 5 s, plus a per-user rate limit.
- **Order creation**, before replacing an open order.
- **Admin "Check with Razorpay"** (audited).
- **Background sweep** (`worker.ts`, every 60 s, long-running server only):
  - Open orders older than 2 minutes, at most 12 checks each, with attempts² minutes back-off and 20 per tick.
  - REQUESTED/PENDING refunds.
  - Unsent confirmation emails (at most 5 attempts).

The sweep keeps no state in memory, so restarts resume, and it is safe on several instances. **Serverless (Vercel) does not run the sweep:** there, recovery relies on webhooks (configure them!) and on the on-demand checks above. If that is not enough, run the API as a long-running process or add a scheduled job that calls the sweep (CLIENT-CLARIFICATIONS W-items / Phase 11 BullMQ).

## 11. Refunds and audit

`POST /admin/payments/transactions/:id/refunds` (`payments.view` + `payments.refund`) with `{ amountMinor?, reason, revokeAccess, idempotencyKey }`:

1. **One transaction, payment row locked:**
   - the payment must be CAPTURED;
   - the amount must be ≤ refundable (captured − processed − in-flight) and ≥ ₹1 (omitted = the whole balance);
   - the same `idempotencyKey` returns the same refund, even for concurrent clicks;
   - a REQUESTED row with a unique `receipt` (`RF-<uuid>`) is written **before** Razorpay is called;
   - `revokeAccess: true` cancels the enrolment activated by this order, an explicit and audited administrator decision. **Refunds never revoke access by themselves** (N-03 / AD-01 pending).
2. **Razorpay `POST /payments/:id/refund`** with that receipt. Razorpay refuses a duplicate receipt on a payment, so a retry after a timeout cannot refund twice:
   - REJECTED → first looked up by receipt (it may already exist), otherwise FAILED with Razorpay's reason;
   - unknown outcome → stays REQUESTED and is re-checked by receipt, then re-submitted only when provably absent.
3. **PENDING → PROCESSED / FAILED** via `refund.*` webhooks or reconciliation. `payments.refunded_minor` is recomputed from PROCESSED refunds (never double-counted). The payment row is not rewritten. Refunds issued directly in the Razorpay Dashboard are discovered and recorded without a requester.

No automated test or development step issues a real refund. Tests use the in-memory fake.

## 12. Notifications and receipts

- **Confirmation email** (`payment-confirmation`): sent only after the order is PAID **and** the enrolment is committed, outside the transaction. Exactly-once is enforced by a conditional claim on `orders.confirmation_email_claimed_at`, so duplicate webhooks, callbacks and sweeps cannot send twice. A failed send releases the claim and is retried by the sweep (at most 5 attempts). A failing email never affects the payment. It uses the existing email service (Resend in production, console locally).
- **Refund email** (`refund-update`): once per PROCESSED refund (claimed through `refunds.notified_at`).
- **Receipt:** `GET /student/orders/:id/receipt` and the page `/student/payments/:orderId/receipt` (print / save as PDF in the browser). Only for the owner's PAID order with an applied captured payment, built from stored verified data. It is marked **"not a tax invoice"**: no GSTIN, tax rate or address is invented (M-04 / AD-05).

## 13. Administration and permissions

| Permission          | Granted to                    | Allows                                                                                                    |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `payments.make_own` | STUDENT                       | Checkout, own orders, status checks, own receipts                                                         |
| `payments.view`     | ADMIN, SUPER_ADMIN            | `/admin/payments`: summary, orders, transactions (failed / processing / needs review), refunds, reconcile |
| `payments.refund`   | SUPER_ADMIN (S-02/AD-03 open) | Requesting refunds (with `payments.view`)                                                                 |

Run `npm run db:seed` after deploying (idempotent). Users must sign in again to receive new permissions in their access token.

**Summary definitions** (always for one mode; INR today, grouped by currency):

- **Gross collected:** Σ captured payment amounts, captured in the period. Each Razorpay payment is one row, so duplicate webhooks or reconciliations cannot double-count.
- **Refunded:** Σ PROCESSED refunds in the period.
- **Net collected:** gross − refunded, before Razorpay fees and taxes, which the platform does not know.
- **Counts:** paid orders, orders awaiting payment, failed attempts, needs review, refunds in progress.

## 14. API

Student (`/api/v1/student`, STUDENT role + `payments.make_own`, `Cache-Control: no-store`):

| Method & path              | Purpose                                                       | Limit  |
| -------------------------- | ------------------------------------------------------------- | ------ |
| `GET /checkout/:slug`      | Quote: availability, server price, mode, resumable open order | —      |
| `POST /orders`             | `{ courseId }` → order + Razorpay checkout data               | 10/min |
| `GET /orders`              | Own order/payment history (`?status=&page=`)                  | —      |
| `GET /orders/:id`          | One own order                                                 | —      |
| `POST /orders/:id/verify`  | Checkout callback → server verification                       | 20/min |
| `POST /orders/:id/refresh` | Check status with Razorpay                                    | 30/min |
| `GET /orders/:id/receipt`  | Receipt (PAID only)                                           | —      |
| `POST /courses/:id/enroll` | Free enrolment (Phase 07, unchanged; no order)                | —      |

Admin (`/api/v1/admin/payments`): `GET /config`, `GET /summary`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/reconcile`, `GET /transactions`, `POST /transactions/:id/refunds` (10/min), `GET /refunds`, `POST /refunds/:id/reconcile`. The filters are `mode`, `status`, `courseId`, `from`/`to` (UTC days), `q` (student name/email or reference) and `needsReview` (transactions).

Webhooks: `POST /api/v1/payments/webhooks/razorpay[/test|/live]` (public, signature-verified).

## 15. Security boundary

- Card, UPI and bank details are entered only in Razorpay Checkout (Razorpay's iframe and origin). The platform never receives, stores or logs them; it stores the method name only.
- **This is not a PCI DSS compliance claim.** Using Razorpay Checkout reduces the platform's scope, but the academy's obligations (e.g. a self-assessment questionnaire, Razorpay's merchant terms) must be confirmed independently.
- **Secrets:** only in the API environment. Never in responses, logs, audit rows, validation messages or the web bundle (tested). Secrets are compared with constant-time HMAC checks.
- **Authority:** prices, payment status and enrolment activation are server-side only, with ownership checks on every order, receipt and refund and strict Zod bodies.
- **Rate limits:** applied to order creation, verification, status checks, refunds and webhooks.
- **Errors and audit:** errors are sanitized (provider details are logged, never returned), and all financial administration is audited.

## 16. Testing

```bash
npm test                    # API (real PostgreSQL *_test DB): includes payments.test.ts + payments-unit.test.ts
npm test -w @asra/web       # web: includes tests/payments.test.ts
```

- **`payments.test.ts`** (HTTP + database):
  - server pricing and discounts; strict bodies; unpublished, private, unpriced and free courses; disabled configuration;
  - concurrent checkouts; provider failure and retry; already enrolled;
  - verified activation exactly once (duplicate callbacks, one email); IDOR; receipts; capture of authorised payments;
  - forged, mismatched and foreign payments; failed attempt then retry; provider timeout settled by webhook; lost callback and lost webhook settled by the sweep; email failure retried; price change and late payment honoured; duplicate payment flagged;
  - webhook signature, modified, missing and wrong-secret bodies; duplicates; concurrent deliveries; out-of-order and stale failures; capture after failure; amount/currency mismatch; expiry; mode mismatch; unknown order; unconfigured secret; processing failure and redelivery;
  - test/live isolation; refund authorisation; full, partial and over-limit refunds; idempotent concurrent refunds; refund webhook dedup; revoke option; provider refusal; unknown outcome recovered by receipt; admin lists, search and summary.
- **`payments-unit.test.ts`:** env rules, signatures (raw-body sensitivity), pricing boundaries, state transitions, the REST gateway against a stubbed `fetch` (auth header, bodies, error classes, no secret in errors).

**Manual test-mode verification** (not automated, needs test keys and optionally a tunnel for webhooks):

1. Buy a course with a test card or UPI.
2. Check that the course opens and Payments shows a receipt.
3. Close the window mid-payment, then use "Check payment status".
4. Refund from `/admin/payments`.

## 17. Deployment checklist

1. `npm run db:migrate:deploy` then `npm run db:seed` (Neon: direct URL).
2. API environment: the variables in §2 for the chosen mode (test on staging, live on production after activation).
3. Razorpay Dashboard: webhook per mode with the event list in §2.1. Automatic capture is recommended.
4. Prefer a long-running API process for the reconciliation sweep. On Vercel, webhooks are essential (§10).
5. Do one controlled live purchase and refund. Confirm the email, receipt and admin summary.

## 18. Troubleshooting

| Symptom                                                   | Likely cause / fix                                                                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API refuses to start: `RAZORPAY_*`                        | The message names the variable: wrong key prefix for the slot, key without secret, live mode outside production, missing production webhook secret.                               |
| Checkout page: "Online payment is not available"          | `RAZORPAY_MODE` empty, or its keys missing on the API.                                                                                                                            |
| Payments stay "being confirmed"                           | Webhook not configured or failing (Dashboard → Webhooks → delivery logs); use "Check with Razorpay" on the order. Authorised but not captured → enable auto-capture or reconcile. |
| Webhook deliveries fail with 400                          | Wrong secret for that URL's mode (test vs live), or a proxy/body parser altered the body before the API.                                                                          |
| Webhook 503                                               | No webhook secret configured for that mode on this deployment.                                                                                                                    |
| Order "cannot be processed here" (503)                    | The order was created in the other mode and that mode's keys were removed; restore them until old orders settle.                                                                  |
| Payment under "Needs review"                              | Paid twice, or paid while already enrolled, or amount mismatch: refund the flagged payment if appropriate.                                                                        |
| Prisma error `column enrollments.order_id does not exist` | The Phase 10 migration has not been applied to that database: `npm run db:migrate:deploy` (then `npm run db:seed`).                                                               |

## 19. Known limitations

- Live mode is implemented but **not verified** against a live Razorpay account (activation/KYC pending, M-02).
- No coupon/offer engine (M-06): only the course-level discount is applied. INR only (M-03).
- The receipt is not a GST tax invoice (M-04). No PDF is generated server-side; students use the browser's "Save as PDF".
- Offline payments are still recorded as admin enrolments without a payment row (M-07).
- No background sweep on serverless deployments (§10).
- If saving a newly created Razorpay order id fails, that provider order is orphaned. It is unpaid and never shown, and the next attempt creates a new one for the same local order.
