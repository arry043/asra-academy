# ASRA Academy — Production Smoke Tests (PHASE 17)

Version 0.1.0 · Checklist + recorded run of **2026-10-28 ~13:30–13:45 IST** against production commit `d6ca7c7` (web `dpl_7k9FG9ZZEY52EvkfYNYLAJxczaQU`, API `dpl_361E7rcctjQiPex91UzN5xDFyKfi`)

All checks in the recorded run were **read-only** (`GET`/`HEAD`/`OPTIONS`, one cookie-less `POST /auth/refresh` that is refused by design). No user, order, payment, email or other record was created in production.

## 1. Recorded run

### Infrastructure

| #   | Check                                | Expected                  | Actual                                                                              | Result        |
| --- | ------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------- | ------------- |
| I1  | DNS                                  | Records resolve to Vercel | apex A `216.198.79.1`; `www` → apex; `api` CNAME `*.vercel-dns-017.com`. NS GoDaddy | Pass          |
| I2  | TLS `www` / `api`                    | Valid cert for host       | Let's Encrypt, SAN matches, expires 2027-01-13 (auto-renewed by Vercel)             | Pass          |
| I3  | HTTP → HTTPS                         | Redirect                  | `http://asraacademy.in`, `http://www…` → 308 HTTPS                                  | Pass          |
| I4  | Apex → canonical                     | One canonical host        | apex → 308 `www`, but canonical/sitemap use apex                                    | **Fail (B4)** |
| I5  | API liveness `/api/v1/health`        | 200                       | 200 `environment: production`                                                       | Pass          |
| I6  | API readiness `/api/v1/health/ready` | DB and Redis up           | 200 `database: up, redis: up`                                                       | Pass          |
| I7  | Preview deployments                  | Not public                | 302 to Vercel login                                                                 | Pass          |

### Public website

| #   | Check                                                 | Expected                    | Actual                                              | Result        |
| --- | ----------------------------------------------------- | --------------------------- | --------------------------------------------------- | ------------- |
| P1  | `/`                                                   | 200                         | 200 (1.1 s)                                         | Pass          |
| P2  | `/courses`, `/about`, `/faculty`, `/verify`, `/login` | 200                         | 200 each (`/courses` 5.4 s first load — cold start) | Pass          |
| P3  | Unknown route                                         | Branded 404                 | 404                                                 | Pass          |
| P4  | `/design-system`                                      | 404 in production           | **200**                                             | **Fail (B3)** |
| P5  | Public catalogue content                              | Only real, approved courses | **Test course "Cyber Security Master"** published   | **Fail (B2)** |
| P6  | `/robots.txt` (pre-launch)                            | `Disallow: /`               | `Disallow: /`                                       | Pass          |
| P7  | Meta robots (pre-launch)                              | `noindex`                   | `noindex, nofollow`                                 | Pass          |
| P8  | `/sitemap.xml`                                        | Valid, canonical URLs       | Valid XML; URLs use apex (redirecting)              | **Fail (B4)** |

### Security

| #   | Check                                                     | Expected                                              | Actual                                                             | Result |
| --- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| S1  | Web headers                                               | CSP, HSTS, nosniff, DENY, referrer, permissions, COOP | All present; CSP `connect-src` = `https://api.asraacademy.in`      | Pass   |
| S2  | API headers                                               | `no-store`, HSTS, nosniff, `X-Request-Id`             | All present; no `X-Powered-By`                                     | Pass   |
| S3  | CORS                                                      | Own origins only                                      | `www` and apex allowed; `https://evil.example` gets no CORS header | Pass   |
| S4  | Protected API anonymously (`/api/v1/admin/dashboard`)     | 401                                                   | 401                                                                | Pass   |
| S5  | Refresh without cookie                                    | 401, safe message                                     | 401 "Your session has expired"                                     | Pass   |
| S6  | Unknown API route                                         | JSON 404, no stack                                    | JSON 404                                                           | Pass   |
| S7  | Portal pages anonymously (`/student/dashboard`, `/admin`) | No data; redirect to login                            | 200 shell (client redirects; data refused by API, S4)              | Pass   |
| S8  | Certificate verify, unknown id                            | 404, no detail                                        | 404 "Certificate not found"                                        | Pass   |
| S9  | Health disclosure                                         | Minimal                                               | Reports environment name (known observation, QA log)               | Note   |

### Not run (need authorisation, accounts or configuration)

| #   | Check                                                       | Why not run                                                    |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| N1  | Sign-in / sign-out per role, protected portal data          | No production test accounts; creating them needs authorisation |
| N2  | Learning workflow, progress, assessment access              | Same                                                           |
| N3  | Certificate download and verification of a real certificate | Same                                                           |
| N4  | Email delivery                                              | Needs an authorised safe test (B5)                             |
| N5  | Payment                                                     | Razorpay not configured; never with a real charge              |
| N6  | Monitoring event                                            | No monitoring provider (B6)                                    |

## 2. Checklist for each future release

Run in this order after every production deployment; record outcomes like §1.

1. `GET https://api.asraacademy.in/api/v1/health/ready` → `database: up`, `redis: up`.
2. Home, `/courses`, one course page, `/verify` → 200; an unknown URL → 404.
3. `/design-system` → 404.
4. Response headers on `/` and `/api/v1/health` as in S1/S2.
5. `robots.txt` / meta robots match the launch state (pre-launch: blocked; after launch: allowed, portals disallowed).
6. Sign in with the designated **production smoke account** for each role (to be created with approval, test-named, not enrolled in real courses); open dashboard; sign out.
7. Student smoke account: open an enrolled smoke course lesson; progress page loads.
8. Verify a known smoke certificate ID publicly.
9. Password reset to a team mailbox → email arrives from the academy domain, link points to the canonical host.
10. If payments are enabled: open `/admin/payments` (mode shown correctly). Do **not** make a purchase except the one controlled live purchase+refund at go-live (PAYMENTS §17).
11. Watch Vercel runtime logs for 5xx for 30 minutes.
