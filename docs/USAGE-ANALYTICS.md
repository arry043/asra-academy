# ASRA Academy — Usage Analytics (PHASE 18)

Version 0.1.0 · 2026-10-30 · Metric definitions: [ADMIN-DASHBOARD.md](./ADMIN-DASHBOARD.md) · Privacy decisions: CLIENT-CLARIFICATIONS U-05, Y-06, AH-07

## Status: **NO USAGE FINDINGS YET**

No usage data has been read. The in-app analytics need an administrator sign-in, and no production account or database access was given for this review. Production database credentials were deliberately not pulled from Vercel.

## 1. What was actually observed

| Metric                   | Value                                                         | Source                       | Period (2026-10-30, UTC) | Type     | Limitation                                          |
| ------------------------ | ------------------------------------------------------------- | ---------------------------- | ------------------------ | -------- | --------------------------------------------------- |
| Published public courses | 1 (`cyber-security-master`, test content, B2)                 | Public API `/api/v1/courses` | 10:43                    | Observed | Public courses only                                 |
| API requests             | 32, all from this review's probes or the web app's own server | Vercel request log           | about 10:41–11:14        | Observed | Very short window. Says nothing about any other day |
| Web requests             | 18: 16 from this review, 2 others to `/`                      | Vercel request log           | about 10:41–11:14        | Observed | Origin of the other 2 not examined                  |

**Do not read this as "no one uses the platform".** It covers about half an hour on a single day. Older request logs are refused on the current plan.

## 2. Metrics and where they would come from

| Metric                           | Definition                                   | Source                                                | Status                                                                |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Student growth                   | See ADMIN-DASHBOARD                          | Admin → Analytics (`/admin/analytics/student-growth`) | Available; not read                                                   |
| Enrolments                       | See ADMIN-DASHBOARD                          | `/admin/analytics/enrollments`                        | Available; not read                                                   |
| Course popularity                | See ADMIN-DASHBOARD                          | `/admin/analytics/popular-courses`                    | Available; not read                                                   |
| Course completion                | See ADMIN-DASHBOARD                          | `/admin/analytics/completion`                         | Available; not read                                                   |
| Exams and assessments            | See ADMIN-DASHBOARD                          | `/admin/analytics/exams`                              | Available; not read                                                   |
| Faculty activity                 | See ADMIN-DASHBOARD                          | `/admin/analytics/faculty`                            | Available; not read                                                   |
| Certificates issued              | Count of certificate records                 | Admin → Certificates                                  | Available; not read                                                   |
| Payment outcomes                 | See PAYMENTS                                 | Admin → Payments                                      | **Not applicable:** Razorpay not configured                           |
| Sign-in patterns, active users   | Not defined                                  | Only `AuthSession` records and short-lived logs       | **No reporting exists.** Would need a definition and a privacy review |
| Course page views                | Not defined                                  | None                                                  | **Not measured** (no web analytics)                                   |
| Abandoned workflows              | Not defined                                  | None                                                  | **Not measured**                                                      |
| Mobile versus desktop            | Not defined                                  | User agent in request log, about 3 hours only         | **Not reliably available**                                            |
| Page and API latency in real use | Server: `responseTime`. Browser: not defined | API logs, about 1 hour; probe history once active     | **Partial.** No field data for real users                             |
| Common errors                    | Count by route                               | Logs, about 1 hour                                    | **Not retained**                                                      |

## 3. Rules for any analysis

- Aggregates only. Do not extract an individual student's activity unless a specific operational question needs it. Many students are minors.
- Use the smallest data that answers the question. Read through the admin portal, not direct database queries.
- Every reported number states its definition, source, date range, limitations and whether it is observed, sampled or estimated.
- Never publish numbers in this file that identify a person or a small group: this repository is public.

## 4. Recommendation

**Do not add anything before launch.** The admin portal already answers the important operational questions (enrolment, completion, assessment, certificates), so read it first, once real students exist.

If the client then wants traffic and device data, the smallest option is cookie-free, aggregate page analytics such as Vercel Web Analytics. It needs:

1. Client approval (U-05, Y-06, AH-07) and a privacy-notice entry.
2. A CSP change, if the script is served from a new origin.
3. A code change and a release.
4. A check of its availability and limits on the chosen Vercel plan.

Application error tracking is a separate decision: see PRODUCTION-DEPLOYMENT B6.
