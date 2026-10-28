# ASRA Academy — UAT Environment & Access Setup (PHASE 16)

Version 0.1.0 · 2026-10-28 · For the **authorised environment operator**. Plan: [UAT-PLAN.md](./UAT-PLAN.md)

> **Status: NOT PERFORMED.** No staging environment, account or integration has been created by this phase. The steps below are a checklist for the person authorised to do it, with the academy's credentials.

**Rules that apply to every step**

- No password, API key, webhook secret, token or connection string is ever written into this repository, a Markdown file, a ticket, a chat message or a log. Secrets go only into the hosting platform's secret manager, and passwords are handed to testers through a one-time secret link or a password manager share.
- Never point any UAT tool or command at the **production** database, production Razorpay live keys or production admin accounts.
- Do not weaken authentication, roles, rate limits, cookie settings, CORS or the Content-Security-Policy to make access easier.
- Use only invented test data. No real student names, phone numbers, dates of birth or documents, especially of minors.

---

## 1. Staging environment

### 1.1 Topology (required by the authentication design)

The web app and API **must be same-site** (AUTHENTICATION.md §5, ADR-013). The session cookie is `SameSite=Strict`.

- ✅ Recommended: subdomains of the academy's domain, e.g. `uat.<academy-domain>` (web) and `uat-api.<academy-domain>` (API). Exact names: `<to be decided — W-01, W-04>`.
- ❌ Do **not** use two separate `*.vercel.app` (or other public-suffix) hostnames. They are cross-site, so login would not survive a page reload.
- ❌ Do **not** "fix" a cross-site setup by setting `AUTH_COOKIE_SAME_SITE=none`. There is no CSRF-token mechanism to go with it.

Restrict who can reach staging (hosting-platform password protection, IP allow-list or similar) if the academy prefers. This sits **in front of** the app and does not replace the app's own login.

### 1.2 Database and Redis

1. Create a **separate** database for UAT (e.g. a Neon branch named `uat`, created from an **empty** parent, not from production data).
2. Provision a **shared** Redis for the staging API (SECURITY.md §6.1). Without one, rate limits fall back to per-instance memory.
3. From the operator's machine, with `DATABASE_URL` / `DIRECT_DATABASE_URL` pointing **only** at the UAT database:
   ```bash
   npm run db:migrate:deploy
   npm run db:seed          # roles and permissions only; creates no users and no passwords
   ```
4. Double-check the host in the connection string before running anything. Close the terminal session afterwards so the variables are not reused by mistake.

### 1.3 API environment (staging)

Set in the hosting platform's secret manager (values are **not** listed here). Reference: `.env.example`, README "Environment variables".

| Variable                                                                           | UAT setting                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                         | `production` (staging behaves like production)                                                 |
| `DATABASE_URL`, `DIRECT_DATABASE_URL`                                              | UAT database only                                                                              |
| `REDIS_URL`                                                                        | Shared staging Redis (`rediss://`)                                                             |
| `JWT_SECRET`                                                                       | New random value, used only on staging (never the local or production value)                   |
| `AUTH_COOKIE_SECURE`                                                               | `true` (enforced in production mode)                                                           |
| `AUTH_COOKIE_SAME_SITE`                                                            | `strict` (default — do not change)                                                             |
| `NEXT_PUBLIC_APP_URL`, `CORS_ORIGINS`                                              | Staging web origin only                                                                        |
| `EMAIL_TRANSPORT`                                                                  | `resend` — **required**: the API refuses to start in production mode with `console`/`memory`   |
| `EMAIL_FROM`                                                                       | Sender on the domain verified in Resend (Q-02)                                                 |
| `EMAIL_API_KEY`                                                                    | Resend key with sending access only                                                            |
| `RAZORPAY_MODE`                                                                    | `test`, or **empty** if test keys are not available (online checkout then shows "unavailable") |
| `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET` | Razorpay **Test Mode** values (key id starts `rzp_test_`)                                      |
| `RAZORPAY_ALLOW_TEST_MODE_IN_PRODUCTION`                                           | `true` (staging only — this is what permits test mode with `NODE_ENV=production`)              |
| `RAZORPAY_LIVE_*`                                                                  | **Never set on staging**                                                                       |
| `GOOGLE_MEET_CLIENT_ID`, `GOOGLE_MEET_CLIENT_SECRET`, `GOOGLE_MEET_REFRESH_TOKEN`  | All three, or none (manual links)                                                              |

### 1.4 Web build environment (staging)

| Variable                      | UAT setting                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`         | Staging web URL                                                                         |
| `NEXT_PUBLIC_API_URL`         | Staging API URL including `/api/v1`, set **at build time** (it is written into the CSP) |
| `SITE_INDEXING_ENABLED`       | **Empty** (staging must not be indexed)                                                 |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Empty until the academy supplies the number (P-02)                                      |
| `ENABLE_DESIGN_SYSTEM`        | Optional `true` if the academy wants to review the design showcase                      |

### 1.5 Deploy and smoke check

1. Deploy the agreed commit. Record its hash in UAT-PLAN §4.
2. `GET <api>/health` returns OK. The API log shows no "in-memory fallback" warning for the rate limiter.
3. Home page loads over HTTPS; `/robots.txt` disallows everything (indexing off).
4. Sign in as each test role (§3) and open one page per portal; reload the page and confirm you stay signed in (this proves the same-site cookie works).
5. `/admin/payments` shows the expected mode ("Test mode (active)" or checkout disabled).

Record the outcome in UAT-PLAN §5, item E11.

---

## 2. Integrations

| Integration         | UAT mode                                                                  | Who provides                                                 | Status                 | If not provided                                                            |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------- |
| Email (Resend)      | Real sending from a verified domain to **team-controlled mailboxes only** | Academy: domain DNS (SPF/DKIM); Resend account               | Not configured         | **Staging cannot start** — UAT blocked                                     |
| Payments (Razorpay) | **Test Mode** — no real money                                             | Academy: Razorpay account (test mode needs no KYC)           | Not configured         | Payment cases recorded _Blocked_; online checkout shows "unavailable"      |
| Google Meet         | Real meetings owned by an academy Google account                          | Academy: Google account + Cloud project access (AE-01/AE-02) | Not configured         | Faculty paste meeting links manually; the automatic-link case is _Blocked_ |
| Storage / uploads   | —                                                                         | —                                                            | Not implemented (R-01) | —                                                                          |
| WhatsApp            | Click-to-chat button only                                                 | Academy: number (P-02)                                       | Not configured         | No button shown                                                            |

### 2.1 Razorpay test mode

Follow [PAYMENTS.md §2.1](./PAYMENTS.md). In short:

1. Razorpay Dashboard → **Test Mode** → API Keys → generate. Store the values in the staging secret manager.
2. Test webhook URL `https://<staging-api>/api/v1/payments/webhooks/razorpay/test`, new random secret, events as listed in PAYMENTS.md §2.1.
3. Testers pay only with Razorpay's published **test** instruments (test cards, test UPI ids, netbanking simulator). Real cards must never be entered.

### 2.2 Email

1. Academy adds the Resend DNS records for the sender domain (Q-02); the operator confirms "Verified" in Resend.
2. Create a sending-only API key for staging. Do not reuse it in production.
3. All test accounts must use mailboxes that the academy or project team controls (e.g. sub-addresses of an academy mailbox), so no email reaches a third party.

### 2.3 Google Meet (optional)

Follow [LIVE-CLASSES.md §4](./LIVE-CLASSES.md). Note: while the OAuth consent screen is in "Testing", Google expires the refresh token after **7 days**. Generate it close to the UAT window, or the automatic-link case will fail mid-UAT.

---

## 3. Test accounts

The seed creates **no** users. Accounts are created with the operator CLI, which marks them active and verified and never accepts a password on the command line.

### 3.1 Accounts to create

| Label            | Role        | Purpose                                     | Created by                                                                              |
| ---------------- | ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `uat-admin`      | ADMIN       | Admin cases                                 | Operator CLI                                                                            |
| `uat-faculty-a`  | FACULTY     | Assigned to the test courses                | Operator CLI                                                                            |
| `uat-faculty-b`  | FACULTY     | **Not** assigned, used for isolation checks | Operator CLI                                                                            |
| `uat-student-a`  | STUDENT     | Main learning journey                       | Self-registration during UAT (tests sign-up and email verification) **or** operator CLI |
| `uat-student-b`  | STUDENT     | Isolation checks                            | Operator CLI                                                                            |
| `uat-superadmin` | SUPER_ADMIN | Refunds, roles, audit logs                  | **Only with written approval** (§4)                                                     |

Email addresses: `<team-controlled mailbox per account — to be supplied>`. Display names: clearly fictitious (e.g. "UAT Student A").

### 3.2 Command (operator machine, UAT database only)

```bash
# Password is typed at a hidden prompt — it is not echoed, not in shell history, not in `ps`.
npm run auth:create-user -- --email <mailbox> --name "UAT Faculty A" --role FACULTY
```

- Prefer the hidden prompt. Avoid `NEW_USER_PASSWORD`. If automation forces you to use it, set it for that single command only and clear it afterwards.
- Generate each password with a password manager (≥ 10 characters, D-06). One password per account.
- Hand each password to its tester through a one-time secret link or password-manager share. Never by email together with the username, and never in this repository.
- Ask testers to change their password on first use through **Forgot password**. This also exercises reset email delivery.

### 3.3 After creation

1. Sign in as `uat-admin`. Create the test academic structure and courses (or let the admin tester do it as part of the admin test cases).
2. Assign `uat-faculty-a` to the test courses (course → **Faculty** tab). Leave `uat-faculty-b` unassigned.
3. Prepare at least one **free** course (price exactly ₹0, published, Public) and one **paid** course (price > 0, published). Test courses should be named "UAT —" so they are easy to remove.
4. Lesson media: use links the academy is allowed to share (e.g. an unlisted test video). No real student material.

---

## 4. Super Admin access

The Super Admin role can grant roles, issue refunds and read every audit log. Give it out for UAT **only if** the academy's approver asks for it in writing (record below). Otherwise the operator demonstrates refunds, roles and audit logs on screen, and those cases are marked "Demonstrated by operator".

| Item                                | Value                               |
| ----------------------------------- | ----------------------------------- |
| Super Admin UAT access requested by | `<name / role — not yet requested>` |
| Approved by                         | `<pending>`                         |
| Date                                | `<pending>`                         |
| Account holder                      | `<pending>`                         |

Never share an existing production Super Admin account.

---

## 5. Access handover record

Fill in as accounts are handed over. **Do not record passwords.**

| Account label  | Role        | Holder (tester)    | Handed over on | Channel | Password changed by holder |
| -------------- | ----------- | ------------------ | -------------- | ------- | -------------------------- |
| uat-admin      | ADMIN       |                    |                |         |                            |
| uat-faculty-a  | FACULTY     |                    |                |         |                            |
| uat-faculty-b  | FACULTY     |                    |                |         |                            |
| uat-student-a  | STUDENT     |                    |                |         |                            |
| uat-student-b  | STUDENT     |                    |                |         |                            |
| uat-superadmin | SUPER_ADMIN | (only if approved) |                |         |                            |

## 6. After UAT

- Suspend or delete the UAT accounts, and revoke the staging Resend key, Razorpay test webhook and Google refresh token if they will not be reused.
- Do **not** promote the UAT database or its accounts to production. Production starts from `db:migrate:deploy` + `db:seed` on its own database, with its own secrets and its own staff accounts.
