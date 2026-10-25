# ASRA Academy — Performance Baseline & Optimisation (PHASE 14)

Version 0.1.0 · Measured 2026-10-25 on a local production build · Related: [SECURITY.md](./SECURITY.md), [PUBLIC-WEBSITE.md §7](./PUBLIC-WEBSITE.md)

All numbers below are **lab measurements on a developer machine** (Apple Silicon, macOS), not field data from real users. No staging or production deployment was measured.

## 1. Method

| Item        | Setup                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | `npm run build` → `node apps/api/dist/server.js` + `next start` (production mode, local HTTP/1.1, no CDN)                                                                                                     |
| Data        | Throw-away database `asra_academy_perf` (migrated + seeded): 40 courses (30 published Public, 5 published Unlisted, 5 drafts) × 24 lessons, 3,003 users, 12,005 enrolments, 143,537 lesson-progress rows      |
| Lighthouse  | 12.6.1, default **mobile** preset (simulated throttling: 150 ms RTT, 1.6 Mbps, 4× CPU — "Lantern"), Chrome headless. Portal pages measured signed in (fresh session per run). Final run = median-LCP run of 3 |
| API latency | One sequential client, 3 warm-up + 40 requests per endpoint, p50/p95 of wall-clock time, same machine                                                                                                         |
| SEO score   | 66–69 locally **by design**: indexing is disabled outside production (`SITE_INDEXING_ENABLED`), so "page is blocked from indexing" fails. All other SEO audits pass                                           |

**INP** is a field metric and was **not** measured (no real-user data exists). Total Blocking Time (TBT) is reported as the lab proxy for interaction latency.

## 2. Web results (Lighthouse, mobile)

| Page              | Perf before → after | LCP before → after | CLS           | TBT before → after | JS (KB) before → after | Images (KB) before → after |
| ----------------- | ------------------- | ------------------ | ------------- | ------------------ | ---------------------- | -------------------------- |
| Home              | 89 → 93             | 3.82 s → 3.22 s    | 0.000         | 2 → 3 ms           | 193 → 193              | 92 → **48**                |
| Course listing    | 94 → 94             | 3.13 s → 3.08 s    | 0.000         | 1 → 2 ms           | 202 → 203              | 5 → 5                      |
| Course detail     | 95 → 96             | 3.00 s → 2.86 s    | 0.000         | 7 → 2 ms           | 193 → 193              | 165 → **31**               |
| Special course    | 98 → 94             | 2.41 s → 3.13 s ¹  | 0.000         | 7 → 1 ms           | 193 → 193              | 165 → **31**               |
| About             | 94 → 95             | 3.14 s → 3.01 s    | 0.000         | 6 → 2 ms           | 193 → 193              | 92 → 92                    |
| Verify (search)   | 94 → 94             | 3.14 s → 3.14 s    | 0.000         | 5 → 4 ms           | 229 → 238 ²            | 165 → **31**               |
| Student dashboard | 86 → 86             | 4.16 s → 4.16 s    | 0.000         | 6 → 8 ms           | 287 → 288              | 5 → 5                      |
| Course player     | 85 → 85             | 4.44 s → 4.44 s    | 0.000         | 23 → 37 ms         | 336 → 337              | 5 → 5                      |
| Faculty dashboard | 86 → 86             | 4.16 s → 4.16 s    | 0.000         | 6 → 9 ms           | 291 → 292              | 5 → 5                      |
| Admin dashboard   | 87 → 85             | 3.87 s → 4.19 s ³  | 0.084 → 0.084 | 7 → 22 ms          | 351 → 353              | 5 → 5                      |

Accessibility: student and faculty portals 96 → **100**, admin 89 → **93** (brand link name). Best Practices: 100 on every page after the CSP/Zod fix (§4).

¹ The baseline is a single run; the 3 final runs were 3.01–3.15 s, and an intermediate after-change run measured 3.29 s. The page itself got 134 KB lighter, so this is Lantern run-to-run variance (±0.3–0.9 s observed for identical builds), not a regression. ² Verification now imports the shared certificate-number schema. ³ Final runs 3.97–4.19 s; the dashboard is client-rendered after a session refresh, unchanged by this phase.

### Targets (lab, representative public pages)

| Target        | Result                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLS ≤ 0.1     | **Met** on every page (admin 0.084 — KPI cards resize when data arrives)                                                                                                                                                                                                                                                                                                                                                    |
| TBT ≤ 200 ms  | **Met** everywhere (≤ 37 ms)                                                                                                                                                                                                                                                                                                                                                                                                |
| LCP ≤ 2.5 s   | **Not met** under simulated mobile throttling (public pages 2.86–3.22 s). The **observed** (unthrottled) LCP equals FCP on these pages (≈ 40–540 ms): the LCP element is server-rendered heading/brand text with no image dependency. Lantern's estimate is dominated by the framework JavaScript that starts before LCP — react-dom (72 KB gz) and the Next.js runtime (44 KB gz) — which this phase cannot remove. See §6 |
| Mobile layout | No layout or interaction regressions observed; no visual changes were made apart from image resolution                                                                                                                                                                                                                                                                                                                      |

## 3. What changed, with evidence

| Change                                                                                           | Evidence                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Footer logo `sizes="7rem"` (every public page)                                                   | Without `sizes` the 1007 px-wide logo got a 1x/2x `srcset` and phones downloaded the **2048 px** variant (160 KB) for a 112 px image. Now the 256 px variant (26 KB): −134 KB whenever the footer image loads — at first load on short pages (course, special-course and verify pages above), on scroll elsewhere (it is lazy) |
| Home hero `sizes="(min-width: 640px) 13rem, 12rem"` (matches the rendered 179–202 px)            | Was `60vw` → 640 px variant (87 KB). Now 384 px (42 KB)                                                                                                                                                                                                                                                                        |
| About logo `sizes="15rem"` (rendered 240 px)                                                     | Same 640 px variant as before at mobile DPR; no byte change, `sizes` is now accurate                                                                                                                                                                                                                                           |
| Security headers sent on documents only; `/_next/*` assets get `nosniff` only                    | Sending the 0.7 KB CSP on all 13–28 hashed chunks per page added 10–51 KB of header bytes (measured in an intermediate run); removed                                                                                                                                                                                           |
| Zod `jitless` in browsers                                                                        | Zod's `new Function` probe was reported as a CSP violation on every portal page and `/verify` (Best Practices 96). Now 100 and no console issues                                                                                                                                                                               |
| API public catalogue: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=60` | Lets a CDN in front of the API (Vercel) serve repeat catalogue requests (also the web server's own per-request fetches for `/courses/*`) for up to 60 s. Browsers always revalidate. Not measurable locally (no CDN)                                                                                                           |
| Sitemap: hourly ISR + one slim API query                                                         | `GET /sitemap/courses` selects two columns with a bounded `LIMIT 5000`: 0.18 ms in PostgreSQL; uses `courses(status, visibility)` when the table grows                                                                                                                                                                         |

**Tried and reverted:** not preloading the display font (`preload: false` for Plus Jakarta Sans). Median LCP was unchanged on home (3.22 s) and course listing (3.13 s) and slightly worse on course detail (2.86 → 3.00 s), so the change was not kept.

## 4. API latency (local, warm, p50 / p95 ms)

| Endpoint                               | Before      | After       | Cache-Control after                |
| -------------------------------------- | ----------- | ----------- | ---------------------------------- |
| `GET /health`                          | 0.3 / 0.7   | 0.3 / 0.6   | `no-store` (was none)              |
| `GET /courses?pageSize=12`             | 2.0 / 3.3   | 1.9 / 2.9   | `public, max-age=0, s-maxage=60 …` |
| `GET /courses/:slug`                   | 1.9 / 4.0   | 1.8 / 2.0   | `public, max-age=0, s-maxage=60 …` |
| `GET /certificates/verify/:id` (404)   | 0.7 / 0.9   | 0.6 / 0.8   | `no-store` (was none)              |
| `GET /student/dashboard`               | 6.6 / 14.0  | 6.4 / 9.1   | `no-store`                         |
| `GET /student/courses/:id`             | 4.1 / 6.7   | 5.1 / 5.9   | `no-store`                         |
| `GET /student/courses/:id/curriculum`  | 3.9 / 4.8   | 4.1 / 4.5   | `no-store`                         |
| `GET /faculty/dashboard`               | 10.3 / 13.8 | 11.0 / 13.5 | `no-store`                         |
| `GET /faculty/students`                | 9.1 / 13.3  | 9.7 / 12.8  | `no-store`                         |
| `GET /faculty/courses/:id/performance` | 8.3 / 13.1  | 8.5 / 13.4  | `no-store`                         |
| `GET /admin/dashboard`                 | 3.7 / 4.9   | 3.4 / 4.1   | `no-store`                         |
| `GET /admin/analytics/enrollments`     | 2.0 / 3.8   | 2.0 / 3.6   | `no-store`                         |
| `GET /admin/analytics/completion`      | 3.0 / 3.4   | 2.9 / 3.6   | `no-store`                         |
| `GET /admin/users?role=STUDENT`        | 5.5 / 6.2   | 6.4 / 7.1   | `no-store`                         |
| `GET /admin/enrollments`               | 1.6 / 2.2   | 1.6 / 2.4   | `no-store`                         |

No API endpoint exceeded 15 ms p95 at this data volume, so **no query was rewritten and no index was added**: nothing in the measurements justified one. The differences between columns are noise (no query changed). Hosted figures will be dominated by network latency to Neon and cold starts, which this setup does not measure (X-04: launch volume unknown).

## 5. Bundle & secret checks

- Client bundles were searched for the local values of `JWT_SECRET`, `EMAIL_API_KEY` and `DATABASE_URL` and for secret variable names: **0 matches**.
- Largest shared chunks: react-dom 72 KB gz, Next.js runtime 44 KB gz, Zod (portal forms) 31 KB gz.

## 6. Recommendations (not done in this phase)

1. **Measure on staging over HTTP/2 + CDN** (W-06) with WebPageTest or Lighthouse CI against the deployed URL; local Lantern numbers overstate LCP for small static pages.
2. Add **real-user monitoring** (Vercel Speed Insights or similar) to obtain field LCP/INP — requires a client decision on analytics (Y-06/U-05) and a CSP update.
3. The remaining public JS (~190 KB) is mostly the React/Next.js runtime. Further cuts would need page-level work (e.g. making the Navbar disclosure menu CSS-only) and are only worth it if field data shows a problem.
4. Admin KPI cards: reserve their height while loading to remove the 0.084 CLS.
