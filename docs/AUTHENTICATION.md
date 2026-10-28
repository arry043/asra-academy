# ASRA Academy — Authentication & Authorization

| Field   | Value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Version | 0.3.0                                                                    |
| Status  | Phase 03 — implemented                                                   |
| Code    | `apps/api/src` (services, middleware, routes); `apps/web/src/app/(auth)` |

This document describes how users sign in and how the API decides what they may do. The data model is in [DATABASE.md](./DATABASE.md), and the overall architecture in [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-boundaries-and-abstractions).

---

## 1. Overview

```
Browser (Next.js)                         API (Express)                         PostgreSQL
─────────────────                         ─────────────                         ──────────
access token ── memory only ──► Authorization: Bearer <JWT, 15 min>
refresh token ── HttpOnly cookie (path /api/v1/auth) ─► /auth/refresh ─► auth_sessions (SHA-256 hash only)
                                                         authenticate ─► session + user + roles + permissions (1 query)
emailed link #token=… ─────────► POST body ────────────► one_time_tokens (SHA-256 hash only)
```

| Item             | Choice                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Passwords        | Argon2id (`argon2`), m = 19 MiB, t = 2, p = 1 (OWASP baseline). Parameters are stored in each hash and upgraded on login. |
| Access token     | JWT HS256 (`jose`), 15 min (`JWT_ACCESS_TTL_MINUTES`). Claims: `sub`, `sid`, `iss`, `aud`, `iat`, `exp`, `jti` only.      |
| Refresh token    | 256-bit random value in an HttpOnly cookie, **rotated on every use**. Only its hash is stored.                            |
| Session lifetime | 30 days, absolute from login (`REFRESH_SESSION_TTL_DAYS`); refreshing does not extend it.                                 |
| One-time tokens  | 256-bit random value, SHA-256-hashed and single-use. Reset links last 30 min; verification links 24 h.                    |
| Authorization    | Roles and permissions are loaded **from the database on every request**; JWT claims are never trusted for them.           |

## 2. Endpoints

All endpoints are under `/api/v1/auth` and use the standard envelope (`{ success, message, data }` / `{ success: false, message, error: { code, details? } }`). Every auth response carries `Cache-Control: no-store`.

| Method | Path                   | Auth                      | Body                            | Success                                            | Notable errors                                                              |
| ------ | ---------------------- | ------------------------- | ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/register`            | —                         | `{ fullName, email, password }` | **202**, `data: null` (same for existing email)    | 422 validation or unknown field (e.g. `role`), 429                          |
| POST   | `/login`               | —                         | `{ email, password }`           | 200 `AuthSessionData` + refresh cookie             | 401 invalid credentials, 403 `EMAIL_NOT_VERIFIED` / `ACCOUNT_DISABLED`, 429 |
| POST   | `/refresh`             | refresh cookie            | —                               | 200 `AuthSessionData` + **new** cookie             | 401 (cookie cleared), 403 `ACCOUNT_DISABLED`, 403 untrusted origin, 429     |
| POST   | `/logout`              | refresh cookie (optional) | —                               | 200 (always; idempotent), cookie cleared           | 403 untrusted origin                                                        |
| POST   | `/logout-all`          | Bearer                    | —                               | 200 `{ revokedSessions }`                          | 401                                                                         |
| GET    | `/me`                  | Bearer                    | —                               | 200 `AuthUser`                                     | 401                                                                         |
| POST   | `/forgot-password`     | —                         | `{ email }`                     | **202** (always)                                   | 422, 429                                                                    |
| POST   | `/reset-password`      | —                         | `{ token, password }`           | 200                                                | 400 invalid/expired/used link, 422, 429                                     |
| POST   | `/verify-email`        | —                         | `{ token }`                     | 200 `{ status: 'verified' \| 'already-verified' }` | 400 invalid/expired/used link, 422, 429                                     |
| POST   | `/resend-verification` | —                         | `{ email }`                     | **202** (always)                                   | 422, 429                                                                    |

```ts
// @asra/types
interface AuthSessionData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}
interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
}
```

Request bodies are Zod schemas in `@asra/validation` (`registerSchema`, `loginSchema`, …), shared with the web forms. They are `.strict()`, so unknown fields are rejected with 422.

## 3. Flows

### 3.1 Registration (students only)

1. Rate limit (5 per hour per IP), then validate. The email is trimmed and lower-cased.
2. Hash the password with Argon2id. This happens on every path, so timing doesn't reveal whether the email exists.
3. **Existing email:** no account is created. The owner receives an "account exists" email, and the response is the same 202.
4. **New email:** in one insert, create the user (`ACTIVE`, unverified), assign the `STUDENT` role and create an empty `StudentProfile`. Then store a verification token hash and email the link.
5. If email delivery fails, the account still exists. The failure is logged (without the token), and the user can request a new link with `/resend-verification`.

Public registration **cannot** grant any other role: the body has no role field, and unknown fields are rejected. FACULTY, ADMIN and SUPER_ADMIN accounts are provisioned by an operator (§7).

### 3.2 Login

1. Rate limit: 10 **failed** attempts per 15 min per IP. Successful logins don't count.
2. Unknown email or missing password hash → a dummy Argon2 verification (equal timing), then **401 "Invalid email or password"**. A wrong password gets the identical 401.
3. Only after the password is proven:
   - status ≠ `ACTIVE` → 403 `ACCOUNT_DISABLED`;
   - email not verified → 403 `EMAIL_NOT_VERIFIED`. **Verification is mandatory to sign in**, per the D-03 assumption.
4. Rehash the password if the Argon2 parameters have changed, create an `auth_sessions` row, and return the access token. The refresh cookie is set.

### 3.3 Refresh-token rotation and reuse detection

`POST /auth/refresh` reads the cookie and hashes it, then finds the session whose **current or previous** token hash matches:

| Situation                                        | Result                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches the **previous** token (already rotated) | **Reuse ⇒ theft assumed:** the whole session is revoked (`TOKEN_REUSE`) and 401 is returned                                                                         |
| Session revoked or expired, or no match          | 401; the cookie is cleared                                                                                                                                          |
| User no longer `ACTIVE`                          | 403 `ACCOUNT_DISABLED`                                                                                                                                              |
| Valid                                            | Atomic compare-and-swap: `UPDATE … SET token_hash = new, previous_token_hash = old WHERE id = … AND token_hash = old AND revoked_at IS NULL AND expires_at > now()` |
| CAS updated 0 rows (a concurrent refresh won)    | Treated as reuse: session revoked, 401                                                                                                                              |

PostgreSQL row locking serialises concurrent rotations of the same token. Exactly one succeeds, and no request can fork the session into two live tokens. The test suite fires 5 parallel refreshes and gets `[200, 401, 401, 401, 401]`.

**Trade-off:** two tabs refreshing at the _same instant_ would trip reuse detection and sign the user out. The web client makes refresh single-flight per tab. Cross-tab coordination (e.g. `BroadcastChannel`) can be added if this shows up in practice.

Only the immediately previous token is remembered. An older rotated token simply fails with 401; it doesn't trigger revocation.

### 3.4 Logout and session revocation

- `POST /auth/logout` revokes the session that owns the cookie (`LOGOUT`) and clears the cookie. It is cookie-based, so it works after the access token expires. It always succeeds, even with no cookie or an already-revoked session.
- `POST /auth/logout-all` (Bearer) revokes **all** of the caller's sessions (`LOGOUT_ALL`). Other users' sessions are untouched.
- Clearing the cookie is never relied on: revocation is a server-side row update.

### 3.5 Access tokens and revocation

Access tokens carry `sid`, the session id. `authenticate` loads the session, user, roles and permissions in **one query** and rejects the request (401) when:

- the session is revoked or expired;
- the session belongs to a different user than `sub`;
- the user is not `ACTIVE`.

**Logout, password reset, reuse detection and account suspension therefore take effect on the very next request,** without a token blacklist. The cost is one indexed primary-key query per authenticated request. If the database is unreachable, the request fails with 503.

### 3.6 Password recovery

- `/forgot-password` always returns the same 202. For an existing `ACTIVE` account it replaces any unused reset token and emails a link valid for 30 min.
  - Residual timing difference: for existing accounts the request also does a token insert and the email handoff. Moving delivery to a background job (Phase 11, BullMQ) will remove this.
- `/reset-password` runs in one transaction:
  1. Atomically consume the token (`UPDATE … WHERE consumed_at IS NULL AND expires_at > now()`). Concurrent attempts: exactly one wins.
  2. Store the new Argon2id hash.
  3. Mark the email verified (the link proved control of the mailbox).
  4. Delete other unused reset tokens.
  5. **Revoke every session of the user (`PASSWORD_RESET`)**, so a reset signs out all devices.

### 3.7 Email verification

- A link is sent at registration. `/resend-verification` (3 per 15 min per IP) issues a new link and invalidates the previous one. It responds identically for unknown, verified and unverified addresses.
- `/verify-email` consumes the token atomically and sets `email_verified_at`. A reused or expired token gets 400.
- A valid token for an account that is already verified returns `already-verified`.

### 3.8 One-time token links

Links have the form `https://<app>/verify-email#token=…` and `/reset-password#token=…`. The token is in the **URL fragment**, which browsers never send to servers, so it stays out of access logs, proxies and `Referer` headers. The page reads it, removes it from the address bar, and sends it in a POST body.

## 4. Cookie and CSRF strategy

| Attribute | Value                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------- |
| Name      | `asra_refresh`                                                                                     |
| HttpOnly  | always                                                                                             |
| Secure    | `AUTH_COOKIE_SECURE`; defaults to true outside development/test, and is **required** in production |
| SameSite  | `AUTH_COOKIE_SAME_SITE`, default **Strict**                                                        |
| Path      | `/api/v1/auth` (the cookie is never sent to other API routes)                                      |
| Domain    | `AUTH_COOKIE_DOMAIN` (unset = host-only)                                                           |
| Expires   | the session's absolute expiry                                                                      |

**Deployment assumption:** the web app and the API are **same-site**, i.e. they share the registrable domain. Locally that is `localhost:3000` and `localhost:4000` (ports don't affect site). In production it is expected to be e.g. `www.asraacademy.in` and `api.asraacademy.in` (hosting pending, W-01).

Same-site lets the Strict cookie flow on `fetch(..., { credentials: 'include' })`. A cross-site deployment would need `SameSite=None; Secure` plus a CSRF-token mechanism; that is not implemented, because it is not the planned topology.

CSRF defence on the auth routes is layered:

1. **SameSite=Strict:** cross-site requests do not carry the cookie.
2. **Origin check** (`requireTrustedOrigin`) on every non-GET auth request:
   - an `Origin` header must be in `CORS_ORIGINS`;
   - without `Origin`, `Sec-Fetch-Site: cross-site` is rejected;
   - requests with neither header come from non-browser clients, which cannot be CSRF victims.
3. All other protected endpoints use `Authorization: Bearer`, which browsers never attach automatically.

CORS is an explicit allow-list with credentials and never a wildcard. CORS controls who can **read** responses; it does not stop CSRF.

## 5. Authorization (RBAC)

### 5.1 Model

Roles and permissions are rows (`roles`, `permissions`, `role_permissions`, `user_roles`), seeded by `npm run db:seed`. The grant matrix is in [DATABASE.md §8](./DATABASE.md#8-seed). It is least-privilege: e.g. ADMIN does **not** have `admins.manage`, `roles.manage` or `system.manage`, which only SUPER_ADMIN holds.

### 5.2 Middleware

```ts
router.get('/admins', authenticate, requireRole('SUPER_ADMIN'), controller.listAdmins);
router.post(
  '/courses',
  authenticate,
  requirePermission(PERMISSIONS.COURSES_MANAGE),
  controller.create,
);
```

| Middleware                    | Passes when                                | Fails with                                     |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `authenticate`                | valid JWT and live session and active user | 401 `UNAUTHORIZED` (generic message)           |
| `requireRole(...roles)`       | user has **any** of the roles              | 401 if not authenticated, else 403 `FORBIDDEN` |
| `requirePermission(...perms)` | user has **all** of the permissions        | 401 if not authenticated, else 403 `FORBIDDEN` |

`req.auth` (`AuthContext`) is rebuilt from the database on each request. Removing a role or adding a permission therefore takes effect on the next request; the tests cover both.

### 5.3 Resource ownership: required for every future business endpoint

A role or permission says "may do this **kind** of thing". It does not say "on **this** course". Every business service must **also** check ownership or assignment with the resource id, using `accessPolicy` (`apps/api/src/services/access-policy.service.ts`):

| Actor                   | Rule                                                                                                                      | Status                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Faculty                 | `content.manage_assigned` **and** a `CourseInstructor` row for the course                                                 | Implemented: `accessPolicy.canManageCourseContent()` (tested)                                                 |
| Faculty (teaching data) | `students.view_assigned` / `submissions.grade_assigned` / `live_classes.manage_assigned` **and** a `CourseInstructor` row | Implemented (PHASE 08): `accessPolicy.assertTeachesCourse()` — no admin bypass (tested, FACULTY-PORTAL.md §2) |
| Admin                   | `content.manage` → any course                                                                                             | Implemented (same policy)                                                                                     |
| Student                 | `content.view_enrolled` **and** an ACTIVE enrolment in a PUBLISHED course                                                 | Implemented (Phase 07): `accessPolicy.assertCanViewCourseContent()` (tested); see STUDENT-LMS.md §2           |
| Super Admin             | `admins.manage` / `system.manage` for admin and system actions                                                            | Permission checks available; endpoints in later phases                                                        |

Checklist for a new protected endpoint:

1. `authenticate`.
2. `requirePermission(...)` for the capability.
3. In the service, `accessPolicy.assert…(req.auth, resourceId)` for ownership.
4. Write tests for 401, 403 (wrong permission) and 403 (not the owner).

## 6. Rate limiting

`express-rate-limit`, per client IP (IPv6 grouped by /56), fixed windows, responding 429 `RATE_LIMITED` with `RateLimit` and `Retry-After` headers:

| Endpoint            | Limit                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| login               | 10 **failed** attempts / 15 min                                                     |
| register            | 5 / hour                                                                            |
| refresh             | 60 **failed** attempts that present a refresh cookie / 15 min (PHASE 15, QA-DEF-03) |
| forgot-password     | 5 / 15 min                                                                          |
| reset-password      | 10 / 15 min                                                                         |
| verify-email        | 10 / 15 min                                                                         |
| resend-verification | 3 / 15 min                                                                          |

**Store.** With `RATE_LIMIT_STORE=redis` (the default outside tests), counters live in Redis via `rate-limit-redis` and are shared by all API instances.

If Redis is unavailable, each limiter falls back to the library's in-process `MemoryStore`: limits keep working per instance rather than failing open. When ioredis reconnects, the Redis stores re-initialise. This is tested against a live Redis.

Behind a proxy, `trust proxy` is `1` in production, so `req.ip` is the real client address. It must match the hosting topology (W-01).

Per-account throttling (a counter keyed by email) is deliberately not added: it would let anyone lock a victim out. If credential-stuffing becomes a concern, prefer CAPTCHA or step-up challenges.

## 7. Provisioning staff accounts

There is no public way to create FACULTY, ADMIN or SUPER_ADMIN accounts. Until the admin portal exists (S-05), an operator with database access runs:

```bash
npm run auth:create-user -- --email teacher@example.com --name "Full Name" --role FACULTY
# password: typed at a hidden prompt, or supplied via NEW_USER_PASSWORD (never as an argument)
```

The account is created `ACTIVE`, with its email marked verified and the matching profile (FacultyProfile or StudentProfile). The seed never creates accounts.

## 8. Email abstraction

Services call `emailService.sendEmailVerification / sendPasswordReset / sendAccountExistsNotice`. Transports implement `EmailTransport.send()` and must throw on failure.

| `EMAIL_TRANSPORT` | Use                                            | Behaviour                                                                |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `console`         | **development only** (default there)           | Writes the message, including its link, to the API log. Nothing is sent. |
| `memory`          | **tests only** (default under `NODE_ENV=test`) | Keeps messages in memory for assertions.                                 |
| `resend`          | production (any environment that really sends) | Sends via the Resend SDK. Needs `EMAIL_API_KEY` and a verified sender.   |

**The API refuses to start with `NODE_ENV=production`** unless `EMAIL_TRANSPORT=resend`. This avoids silently "succeeding" without delivering verification or reset emails.

With `resend`, startup also requires a non-empty `EMAIL_API_KEY` and an `EMAIL_FROM` of the form `address` or `Name <address>` on a real (non-localhost) domain. Resend only accepts senders on a domain verified in its dashboard (Q-02); that check happens at send time. Validation errors name the variable, never its value.

The Resend SDK returns API and network errors instead of throwing; the transport converts them into a `ResendDeliveryError` that carries only Resend's error code and HTTP status, never the provider message (it can echo the recipient) or the key. Each call times out after 10 seconds. A successful call means Resend accepted the message, not that it reached the inbox. There are no automatic retries.

Delivery failures are logged with the template name and user id only, never the link or token. Forgot-password and resend still return the generic 202; registration still succeeds, and the user can request a new link.

## 9. Password policy

| Rule              | Value                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Minimum length    | **10** characters (pending confirmation, D-06)                                                                           |
| Maximum length    | 128 characters (bounds hashing cost per request)                                                                         |
| Composition rules | **None.** No forced upper-case, digits or symbols (NIST SP 800-63B §3.1.1.2, OWASP). Any Unicode and spaces are allowed. |
| Other             | Must not be only spaces. Validation runs **before** any hashing.                                                         |

Breached-password screening (e.g. a k-anonymity range API) is recommended but not implemented, because it needs an external service decision.

## 10. Logging and secrets

- pino redacts `authorization` and `cookie` headers, `set-cookie`, and any `password`, `passwordHash`, `token`, `tokenHash`, `accessToken`, `refreshToken`, `secret` and `cookie` field (top level or one level deep). Request logs contain only id, method, URL and status.
- Responses never contain hashes, refresh tokens or one-time tokens. `toAuthUser()` whitelists the fields that can leave the API.
- `JWT_SECRET` (≥ 32 characters) is required at startup in every environment. Generate one with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

  Rotating the secret invalidates every access token; users recover through refresh.

## 11. Configuration

| Variable                        | Default                                                   | Notes                                               |
| ------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `JWT_SECRET`                    | — (**required**)                                          | ≥ 32 characters, random                             |
| `JWT_ISSUER` / `JWT_AUDIENCE`   | `asra-academy-api` / `asra-academy-web`                   | Verified on every request                           |
| `JWT_ACCESS_TTL_MINUTES`        | 15                                                        | 1–60                                                |
| `REFRESH_SESSION_TTL_DAYS`      | 30                                                        | 1–90; absolute                                      |
| `PASSWORD_RESET_TTL_MINUTES`    | 30                                                        | 5–1440                                              |
| `EMAIL_VERIFICATION_TTL_HOURS`  | 24                                                        | 1–168                                               |
| `AUTH_COOKIE_SECURE`            | false in development/test, true otherwise                 | Must be true in production                          |
| `AUTH_COOKIE_SAME_SITE`         | `strict`                                                  | `none` requires Secure                              |
| `AUTH_COOKIE_DOMAIN`            | unset                                                     | Only if the API and web need a shared parent domain |
| `CORS_ORIGINS`                  | `NEXT_PUBLIC_APP_URL`                                     | Also the CSRF origin allow-list                     |
| `EMAIL_TRANSPORT`, `EMAIL_FROM` | `console` / `memory`; `ASRA Academy <no-reply@localhost>` | See §8; production requires `resend`                |
| `EMAIL_API_KEY`                 | unset                                                     | Resend key; required when `EMAIL_TRANSPORT=resend`  |
| `RATE_LIMIT_STORE`              | `redis` (`memory` in tests)                               | See §6                                              |

The web app only needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL`. No auth secret is exposed through `NEXT_PUBLIC_*`.

## 12. Frontend

- **Pages** (`apps/web/src/app/(auth)/`): `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`. All are `noindex` and wrapped in `AuthProvider`.
- **`AuthProvider`:**
  - keeps the access token **in memory only**, never in localStorage, sessionStorage or cookies;
  - restores the session on load with one `/auth/refresh`;
  - refreshes 60 s before expiry; refresh is single-flight;
  - `authorizedRequest()` retries **once** after a 401, then gives up.
- Forms validate with the same Zod schemas as the API and show server 422 field errors, 401/403/429 messages and network errors.
- **After sign-in**, the login page shows a confirmation card (name, email, roles, sign-out). Dashboards come in later phases.

## 13. Known limitations

| Limitation                                                                        | Mitigation / plan                                                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Production email needs a Resend-verified sender domain                            | Verify the domain in Resend (Q-02: DNS access for SPF/DKIM/DMARC) before enabling production        |
| Simultaneous refresh from two tabs can sign the user out (strict reuse detection) | Single-flight per tab; add cross-tab coordination if needed                                         |
| Forgot-password has a small timing difference for existing accounts               | Move email sending to BullMQ (Phase 11)                                                             |
| No MFA, no breached-password check, no account lockout notifications              | Future hardening (Phase 13)                                                                         |
| Expired or revoked session and token rows are kept                                | Add a scheduled cleanup job (Phase 11)                                                              |
| Auth events are not yet audit-logged (FR-AUD-002)                                 | Audit log module (later phase)                                                                      |
| HS256 shared secret                                                               | Fine for a single issuer/verifier; switch to an asymmetric key if other services must verify tokens |

## 14. Local setup and tests

```bash
cp .env.example .env              # then set POSTGRES_PASSWORD and JWT_SECRET (see §10)
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev                       # web :3000, API :4000

# Register at http://localhost:3000/register — the verification link is printed in the API log.
# Staff accounts:
npm run auth:create-user -- --email admin@example.com --name "Local Admin" --role ADMIN

npm test                          # all API tests, including auth (local *_test database, memory email)
```
