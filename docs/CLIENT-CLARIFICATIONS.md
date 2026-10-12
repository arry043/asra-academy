# ASRA Academy — Client Clarifications

Version 0.1.0 · Prepared by Marvel's Techworks for ASRA Academy

Each item below cannot be safely assumed from the Project Development Order or the visual reference. Development of the technical foundation continues using **provider-independent abstractions, environment variables and data-driven configuration**, so no answer here blocks Phase 01. Answers are required before the phase noted in **Needed by**.

**Status values:** `PENDING CLIENT CONFIRMATION` · `PARTIALLY CONFIRMED` · `CONFIRMED` (answer recorded) · `NOT APPLICABLE`

---

## A. Academic Structure

| ID   | Question                                                                                                  | Why it matters                                             | Current assumption                                                                 | Needed by         | Status                      |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------- | --------------------------- |
| A-01 | What is the final subject list for each class (6, 7, 8, 9, 10)?                                           | Drives catalogue data, faculty allocation and public pages | Subjects are admin-managed data; list from Order §2A used only as sample seed data | Phase 06          | PENDING CLIENT CONFIRMATION |
| A-02 | Which streams are offered for Classes 11–12 (e.g. Science, Commerce, Arts) and which subjects per stream? | Stream → subject mapping changes the academic hierarchy    | Streams are an optional, admin-managed level                                       | Phase 02 (schema) | PENDING CLIENT CONFIRMATION |
| A-03 | Is CBSE the only board, or will state boards/ICSE be added?                                               | Determines whether "board" is a modelled entity            | CBSE only; schema allows a board/curriculum label                                  | Phase 02          | PENDING CLIENT CONFIRMATION |
| A-04 | Is a student enrolled per class (all subjects) or per individual subject?                                 | Fundamental to enrolment, pricing and access control       | Enrolment per course (a course may be a single subject or a bundle)                | Phase 02          | PENDING CLIENT CONFIRMATION |
| A-05 | What are the academic session dates (e.g. April–March) and does content roll over each year?              | Batches, enrolment expiry, reporting periods               | Session/batch is an optional attribute                                             | Phase 06          | PENDING CLIENT CONFIRMATION |
| A-06 | Teaching medium per subject (English/Hindi/Urdu)?                                                         | Content labelling and filtering                            | Language is a course attribute                                                     | Phase 06          | PENDING CLIENT CONFIRMATION |
| A-07 | How should "progress" be measured (lesson completion %, assessment scores, attendance)?                   | Progress tracking logic and reports                        | Lesson completion % + assessment scores                                            | Phase 07          | PENDING CLIENT CONFIRMATION |

## B. Courses

| ID   | Question                                                                                                                  | Why it matters                            | Current assumption                         | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ | --------- | --------------------------- |
| B-01 | For each special course (English, Entrepreneurship & Business, Quranic Studies, Arabic, Urdu): what levels/modules exist? | Course structure and public pages         | Generic course → module → lesson structure | Phase 06  | PENDING CLIENT CONFIRMATION |
| B-02 | Course duration and validity (fixed term, lifetime, per academic year)?                                                   | Enrolment expiry and access rules         | Optional validity period per course        | Phase 10  | PENDING CLIENT CONFIRMATION |
| B-03 | Are courses self-paced, batch-based (cohorts with schedules), or both?                                                    | Live-class scheduling and enrolment model | Both supported via optional batches        | Phase 06  | PENDING CLIENT CONFIRMATION |
| B-04 | Which courses are free and which are paid?                                                                                | Payment flow and access control           | Free/paid is a per-course flag             | Phase 10  | PENDING CLIENT CONFIRMATION |
| B-05 | Who defines Quranic Studies / Islamic studies curriculum content ("as determined by the academy")?                        | Content ownership and review              | Academy supplies curriculum                | Phase 06  | PENDING CLIENT CONFIRMATION |
| B-06 | Are there age/gender-specific batches (e.g. for Quranic Studies)?                                                         | Batch rules and faculty allocation        | None assumed                               | Phase 06  | PENDING CLIENT CONFIRMATION |

## C. Faculty

| ID   | Question                                                                   | Why it matters                   | Current assumption                              | Needed by | Status                      |
| ---- | -------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- | --------- | --------------------------- |
| C-01 | How many faculty members at launch, and their subject allocations?         | Seed data and Faculty page       | Admin-managed                                   | Phase 06  | PENDING CLIENT CONFIRMATION |
| C-02 | Which faculty details are public (photo, qualifications, experience, bio)? | Public Faculty page and privacy  | Name, photo, qualification, subjects, short bio | Phase 05  | PENDING CLIENT CONFIRMATION |
| C-03 | Can faculty publish content directly or does an admin approve first?       | Content workflow and permissions | Faculty publish directly; admins can unpublish  | Phase 08  | PENDING CLIENT CONFIRMATION |
| C-04 | Can faculty see student contact details?                                   | Privacy of minors                | Faculty see name and performance only           | Phase 08  | PENDING CLIENT CONFIRMATION |
| C-05 | Is faculty payroll/attendance in scope?                                    | Not stated in the Order          | Out of scope                                    | —         | PENDING CLIENT CONFIRMATION |

## D. Student Registration

| ID   | Question                                                                                   | Why it matters                    | Current assumption                                            | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------- | --------- | --------------------------- |
| D-01 | Which fields are required at registration (name, email, phone, class, school, city, DOB…)? | Schema and form design            | Name, email, phone, password, class/interest                  | Phase 02  | PENDING CLIENT CONFIRMATION |
| D-02 | Login identifier: email, phone, or both?                                                   | Auth design                       | Email + password; phone stored                                | Phase 03  | PENDING CLIENT CONFIRMATION |
| D-03 | Is email verification required? Is phone OTP required?                                     | Third-party SMS/OTP cost and flow | Email verification yes; OTP not in launch scope               | Phase 03  | PENDING CLIENT CONFIRMATION |
| D-04 | Are admissions automatic on registration/payment or approved manually by admin?            | Admission workflow                | Automatic for free/paid-verified courses; admins can override | Phase 10  | PENDING CLIENT CONFIRMATION |
| D-05 | Should Google/social login be offered?                                                     | Auth providers                    | Not in launch scope                                           | Phase 03  | PENDING CLIENT CONFIRMATION |

## E. Minor / Guardian Information

| ID   | Question                                                                              | Why it matters                                                                                                    | Current assumption                                                   | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | --------------------------- |
| E-01 | Must guardian name/phone/email be captured for students under 18?                     | Order §4 requires "safeguards for minors"; DPDP Act 2023 requires verifiable parental consent for children's data | Capture DOB; require guardian details + consent checkbox if under 18 | Phase 02  | PENDING CLIENT CONFIRMATION |
| E-02 | How should parental consent be verified (checkbox, guardian email confirmation, OTP)? | Legal compliance and flow design                                                                                  | Guardian email confirmation link                                     | Phase 03  | PENDING CLIENT CONFIRMATION |
| E-03 | Do parents/guardians need their own login to view progress?                           | New role and dashboard                                                                                            | No separate login at launch                                          | Phase 03  | PENDING CLIENT CONFIRMATION |
| E-04 | Should guardians receive notifications (results, attendance, payments)?               | Notification events                                                                                               | Not at launch                                                        | Phase 11  | PENDING CLIENT CONFIRMATION |
| E-05 | Rules for minors in live classes (camera on/off, chat, recording consent)?            | Safeguarding and provider configuration                                                                           | Student video/chat controlled by faculty; recordings internal only   | Phase 11  | PENDING CLIENT CONFIRMATION |

## F. Live Classes

| ID   | Question                                                                          | Why it matters                                                   | Current assumption                               | Needed by | Status                      |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | --------- | --------------------------- |
| F-01 | Which live-class provider should be integrated (Zoom, Google Meet, Jitsi, other)? | Backend integration and meeting lifecycle depend on the provider | Provider-independent `LiveClassProvider` adapter | Phase 11  | PENDING CLIENT CONFIRMATION |
| F-02 | Does the academy already hold accounts/licences with that provider?               | API access and host limits                                       | None assumed                                     | Phase 11  | PENDING CLIENT CONFIRMATION |
| F-03 | Expected maximum participants per class and concurrent classes?                   | Plan selection and scalability                                   | Unknown                                          | Phase 11  | PENDING CLIENT CONFIRMATION |
| F-04 | Should recordings automatically become recorded lectures?                         | Storage, processing and workflow                                 | Manual upload by faculty                         | Phase 11  | PENDING CLIENT CONFIRMATION |
| F-05 | Is attendance tracking required?                                                  | Reports and progress                                             | Join-click recorded as attendance                | Phase 11  | PENDING CLIENT CONFIRMATION |
| F-06 | Should classes be embedded in the site or open in the provider's app?             | UX and provider SDK choice                                       | Open provider join link                          | Phase 11  | PENDING CLIENT CONFIRMATION |

## G. Video Hosting

| ID   | Question                                                                                                                 | Why it matters                                | Current assumption                    | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------- | --------- | --------------------------- |
| G-01 | Where should recorded lectures be hosted (dedicated video platform vs. object storage + CDN vs. unlisted YouTube/Vimeo)? | Cost, bandwidth, adaptive streaming, security | Storage abstraction; provider pending | Phase 07  | PENDING CLIENT CONFIRMATION |
| G-02 | Must videos be protected against downloading/sharing (signed URLs, DRM, watermark)?                                      | Provider choice and cost                      | Signed, expiring URLs; no DRM         | Phase 07  | PENDING CLIENT CONFIRMATION |
| G-03 | Expected volume (number of videos, average length, max file size)?                                                       | Storage/bandwidth planning                    | Unknown                               | Phase 07  | PENDING CLIENT CONFIRMATION |
| G-04 | Is existing recorded content available for migration?                                                                    | Content import effort                         | None assumed                          | Phase 06  | PENDING CLIENT CONFIRMATION |

## H. Study Materials

| ID   | Question                                              | Why it matters             | Current assumption                                | Needed by | Status                      |
| ---- | ----------------------------------------------------- | -------------------------- | ------------------------------------------------- | --------- | --------------------------- |
| H-01 | Allowed file types (PDF only, DOCX, PPT, images)?     | Upload validation          | PDF + common images                               | Phase 06  | PENDING CLIENT CONFIRMATION |
| H-02 | Are all notes downloadable, or view-only for some?    | Access control and viewer  | Downloadable for enrolled students (per Order §3) | Phase 07  | PENDING CLIENT CONFIRMATION |
| H-03 | Should PDFs be watermarked with student identity?     | Processing pipeline        | No                                                | Phase 07  | PENDING CLIENT CONFIRMATION |
| H-04 | Any free/preview materials for non-enrolled visitors? | Marketing and access rules | Optional per lesson "preview" flag                | Phase 06  | PENDING CLIENT CONFIRMATION |

## I. Assignments

| ID   | Question                                                             | Why it matters              | Current assumption            | Needed by | Status                      |
| ---- | -------------------------------------------------------------------- | --------------------------- | ----------------------------- | --------- | --------------------------- |
| I-01 | Submission format: file upload, text answer, or both? Max file size? | Upload handling and storage | Both; size limit configurable | Phase 09  | PENDING CLIENT CONFIRMATION |
| I-02 | Are late submissions allowed? Re-submissions?                        | Deadline logic              | Configurable per assignment   | Phase 09  | PENDING CLIENT CONFIRMATION |
| I-03 | Grading scale (marks, grades, pass/fail) and feedback format?        | Results model               | Numeric marks + text feedback | Phase 09  | PENDING CLIENT CONFIRMATION |

## J. Quizzes

| ID   | Question                                                                          | Why it matters             | Current assumption                            | Needed by | Status                      |
| ---- | --------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- | --------- | --------------------------- |
| J-01 | Which question types (MCQ single/multi, true/false, numeric, short answer)?       | Assessment engine scope    | MCQ single/multi, true/false, short answer    | Phase 09  | PENDING CLIENT CONFIRMATION |
| J-02 | Time limits, attempt limits, randomisation, negative marking?                     | Engine rules               | Configurable per quiz                         | Phase 09  | PENDING CLIENT CONFIRMATION |
| J-03 | Who authors quizzes — faculty, admins, or both? Is a shared question bank needed? | Permissions and data model | Faculty and admins; question bank per subject | Phase 09  | PENDING CLIENT CONFIRMATION |
| J-04 | Are answers/solutions shown after submission?                                     | UX and integrity           | Shown after due date                          | Phase 09  | PENDING CLIENT CONFIRMATION |

## K. Examinations

| ID   | Question                                                                        | Why it matters                | Current assumption                                       | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- | --------- | --------------------------- |
| K-01 | How do mock tests differ from examinations (weighting, scheduling, visibility)? | Data model                    | Exam = scheduled, timed assessment; mock = practice exam | Phase 09  | PENDING CLIENT CONFIRMATION |
| K-02 | Are exams scheduled windows with a fixed start time?                            | Scheduling and fairness       | Yes, configurable window                                 | Phase 09  | PENDING CLIENT CONFIRMATION |
| K-03 | Is any proctoring required (tab-switch detection, webcam)?                      | Significant scope/cost        | No proctoring                                            | Phase 09  | PENDING CLIENT CONFIRMATION |
| K-04 | Who publishes results, and are report cards/mark sheets required?               | Workflow and output documents | Faculty/admin publish; no report card PDF at launch      | Phase 09  | PENDING CLIENT CONFIRMATION |
| K-05 | Are subjective answers manually graded by faculty?                              | Grading workflow              | Yes                                                      | Phase 09  | PENDING CLIENT CONFIRMATION |

## L. Certificates

| ID   | Question                                                                        | Why it matters           | Current assumption                       | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- | --------- | --------------------------- |
| L-01 | Which courses issue certificates (special courses only, or school classes too)? | Certificate engine scope | Configurable per course                  | Phase 13  | PENDING CLIENT CONFIRMATION |
| L-02 | Eligibility rules (completion %, minimum exam score, attendance)?               | Issuance logic           | Configurable rule; manual issue by admin | Phase 13  | PENDING CLIENT CONFIRMATION |
| L-03 | Certificate design, signatories and seal?                                       | Template generation      | Client supplies design                   | Phase 13  | PENDING CLIENT CONFIRMATION |
| L-04 | Is public online verification (ID/QR) required?                                 | Public endpoint          | Technical recommendation: yes            | Phase 13  | PENDING CLIENT CONFIRMATION |

## M. Payments

| ID   | Question                                                                                                   | Why it matters                              | Current assumption                                          | Needed by | Status                      |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | --------- | --------------------------- |
| M-01 | Will paid courses be enabled at launch?                                                                    | Order §4 says "if paid courses are enabled" | Payment module built behind a feature flag                  | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-02 | Which payment gateway (Razorpay, Cashfree, PayU, Stripe, other)? Does the academy have a merchant account? | Integration, KYC lead time                  | `PaymentProvider` adapter; provider pending                 | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-03 | Currencies: INR only, or international students too?                                                       | Gateway and pricing model                   | INR only                                                    | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-04 | Are GST invoices/receipts required? GSTIN and invoice format?                                              | Invoice generation                          | Payment receipt only; GST invoice pending                   | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-05 | Pricing model: one-time, monthly, per-term, instalments?                                                   | Payment flows                               | One-time per course                                         | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-06 | Promotional offers: coupon codes, percentage/flat, validity, usage limits, sibling/merit discounts?        | Offer engine                                | Coupon codes with % or flat discount, validity, usage limit | Phase 10  | PENDING CLIENT CONFIRMATION |
| M-07 | Are offline/cash payments recorded manually by admins?                                                     | Payment records                             | Admin can record manual payments                            | Phase 10  | PENDING CLIENT CONFIRMATION |

## N. Refunds

| ID   | Question                                                                       | Why it matters                  | Current assumption              | Needed by     | Status                      |
| ---- | ------------------------------------------------------------------------------ | ------------------------------- | ------------------------------- | ------------- | --------------------------- |
| N-01 | What is the refund policy (eligibility window, partial refunds)?               | Refund Policy page and workflow | Client supplies policy text     | Phase 05 / 10 | PENDING CLIENT CONFIRMATION |
| N-02 | Are refunds processed through the gateway automatically or manually by admins? | Integration scope               | Admin-initiated via gateway API | Phase 10      | PENDING CLIENT CONFIRMATION |
| N-03 | Does a refund revoke course access immediately?                                | Access control                  | Yes                             | Phase 10      | PENDING CLIENT CONFIRMATION |

## O. Notifications

| ID   | Question                                                                                                                               | Why it matters         | Current assumption                        | Needed by | Status                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------- | --------- | --------------------------- |
| O-01 | Which events trigger notifications (registration, enrolment, payment, class reminder, assignment due, result published, announcement)? | Notification catalogue | The listed events                         | Phase 11  | PENDING CLIENT CONFIRMATION |
| O-02 | Which channels per event (email, in-app, WhatsApp, SMS)?                                                                               | Provider and cost      | Email + in-app                            | Phase 11  | PENDING CLIENT CONFIRMATION |
| O-03 | Can students opt out of non-essential notifications?                                                                                   | Preferences model      | Yes, for non-transactional                | Phase 11  | PENDING CLIENT CONFIRMATION |
| O-04 | Who can send announcements (admins only, or faculty to their classes)?                                                                 | Permissions            | Admins globally; faculty to their courses | Phase 11  | PENDING CLIENT CONFIRMATION |

## P. WhatsApp

| ID   | Question                                                                                                             | Why it matters            | Current assumption                          | Needed by | Status                      |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------- | --------- | --------------------------- |
| P-01 | "WhatsApp enquiry integration": a click-to-chat button (wa.me link) or WhatsApp Business API with automated replies? | Very different scope/cost | Click-to-chat link at launch                | Phase 05  | PENDING CLIENT CONFIRMATION |
| P-02 | Which WhatsApp number should receive enquiries?                                                                      | Configuration             | Configurable via environment/admin settings | Phase 05  | PENDING CLIENT CONFIRMATION |
| P-03 | Should WhatsApp be used for transactional notifications? If so, which Business Solution Provider?                    | Template approval, cost   | Not at launch                               | Phase 11  | PENDING CLIENT CONFIRMATION |

## Q. Email

| ID   | Question                                                                                | Why it matters                 | Current assumption                                                                                                                                                              | Needed by | Status                      |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------- |
| Q-01 | Which email provider (e.g. Amazon SES, Resend, SendGrid, Zoho, Google Workspace SMTP)?  | Integration and deliverability | Email channel adapter; provider pending                                                                                                                                         | Phase 11  | PENDING CLIENT CONFIRMATION |
| Q-02 | Sender address/domain (e.g. no-reply@asraacademy.in) and DNS access for SPF/DKIM/DMARC? | Deliverability                 | Domain owned by client                                                                                                                                                          | Phase 11  | PENDING CLIENT CONFIRMATION |
| Q-03 | Who receives Contact Us enquiries by email?                                             | Configuration                  | **asraacademy1@gmail.com** (supplied 2026-10-12). Note: a Gmail address is fine for receiving enquiries, but transactional emails should be sent from the academy domain (Q-02) | Phase 05  | CONFIRMED                   |

## R. Storage

| ID   | Question                                                                                    | Why it matters               | Current assumption                         | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------ | --------- | --------------------------- |
| R-01 | Preferred object-storage provider (AWS S3, Cloudflare R2, other S3-compatible, Cloudinary)? | Adapter implementation, cost | S3-compatible `StorageProvider` adapter    | Phase 06  | PENDING CLIENT CONFIRMATION |
| R-02 | Data residency requirement (storage in India)?                                              | Region selection             | India region preferred                     | Phase 06  | PENDING CLIENT CONFIRMATION |
| R-03 | Retention period for student submissions and recordings?                                    | Storage cost and privacy     | Retained for the academic session + 1 year | Phase 09  | PENDING CLIENT CONFIRMATION |

## S. Admin Roles

| ID   | Question                                                                                                                    | Why it matters                  | Current assumption                                   | Needed by | Status                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- | --------- | --------------------------- |
| S-01 | How many admin users, and are there distinct admin types (super admin, academic admin, accounts, content manager, support)? | RBAC design                     | `ADMIN` + `SUPER_ADMIN`; permission model extensible | Phase 03  | PENDING CLIENT CONFIRMATION |
| S-02 | Who may change prices, record/modify payments, and edit results?                                                            | Sensitive permissions and audit | `ADMIN`+ with audit log                              | Phase 03  | PENDING CLIENT CONFIRMATION |
| S-03 | Which reports are required (enrolments, revenue, attendance, performance, faculty activity)?                                | Reporting module scope          | Those listed                                         | Phase 12  | PENDING CLIENT CONFIRMATION |

## T. Content Ownership

| ID   | Question                                                                     | Why it matters                             | Current assumption                            | Needed by | Status                      |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- | --------- | --------------------------- |
| T-01 | Who owns lecture/notes copyright — the academy or individual faculty?        | Content rights and removal on faculty exit | Academy owns                                  | Phase 06  | PENDING CLIENT CONFIRMATION |
| T-02 | Who writes and supplies public website copy, images and course descriptions? | Content dependency for Phase 05            | Client supplies; placeholders used until then | Phase 05  | PENDING CLIENT CONFIRMATION |
| T-03 | Are licensed stock images/illustrations acceptable?                          | Design assets                              | Yes, licensed only                            | Phase 05  | PENDING CLIENT CONFIRMATION |

## U. Privacy

| ID   | Question                                                                                  | Why it matters                   | Current assumption                                | Needed by | Status                      |
| ---- | ----------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------- | --------- | --------------------------- |
| U-01 | Who drafts the Privacy Policy, Terms and Conditions and Refund Policy (legal review)?     | Mandatory pages; legal liability | Client provides legally reviewed text             | Phase 05  | PENDING CLIENT CONFIRMATION |
| U-02 | Will the academy appoint a grievance/data protection contact (DPDP Act 2023)?             | Privacy page content and process | Client to confirm                                 | Phase 05  | PENDING CLIENT CONFIRMATION |
| U-03 | Data deletion/export requests: what is the process and timeline?                          | Account deletion feature         | Admin-processed request                           | Phase 12  | PENDING CLIENT CONFIRMATION |
| U-04 | Can student names/photos/results be used in testimonials or toppers lists?                | Consent requirements for minors  | Only with explicit guardian consent               | Phase 05  | PENDING CLIENT CONFIRMATION |
| U-05 | Analytics/tracking tools allowed (Google Analytics, Meta Pixel)? Cookie consent required? | Privacy compliance               | Privacy-friendly analytics only, pending approval | Phase 13  | PENDING CLIENT CONFIRMATION |

## V. Branding

| ID   | Question                                                                                                                                                                                                  | Why it matters                        | Current assumption                                                                                                             | Needed by | Status                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------- |
| V-01 | Official logo files (SVG/PNG) and usage guidelines?                                                                                                                                                       | Design system                         | **Logo PNG supplied 2026-10-12** (`docs/brand/`). Still needed: vector (SVG/AI/PDF) file and a light-on-dark variant           | Phase 04  | PARTIALLY CONFIRMED         |
| V-02 | Exact brand colour codes for ASRA green and gold?                                                                                                                                                         | Design tokens                         | Sampled from the supplied logo: green `#012114`, gold `#c88717` (see `docs/brand/README.md`); client to confirm official codes | Phase 04  | PENDING CLIENT CONFIRMATION |
| V-03 | Brand fonts (Latin, and Urdu/Arabic script if used)?                                                                                                                                                      | Typography                            | Open-source sans-serif (Inter/Geist-style)                                                                                     | Phase 04  | PENDING CLIENT CONFIRMATION |
| V-04 | Is the supplied visual reference final for the homepage, or direction only? Are designs needed for inner pages and dashboards?                                                                            | Design scope                          | Direction only; inner pages derived from the design system                                                                     | Phase 04  | PENDING CLIENT CONFIRMATION |
| V-05 | Should the UI be available in Hindi/Urdu/Arabic (including right-to-left layout)?                                                                                                                         | i18n and RTL support                  | English UI at launch; i18n-ready                                                                                               | Phase 04  | PENDING CLIENT CONFIRMATION |
| V-06 | The visual design reference (homepage mock-up) must be added to the repository (`docs/design/`). The logo has been received; the design mock-up has not.                                                  | Shared design source for the team     | Not yet in repository                                                                                                          | Phase 04  | PENDING CLIENT CONFIRMATION |
| V-07 | Tagline and founding statement: confirm exact public wording and placement. Supplied: tagline "Learn • Grow • Succeed"; "Founded by students of AMU". Should "AMU" be written out in full on the website? | Public copy and About page            | Tagline from the logo; "Founded by students of AMU" shown verbatim in the site footer                                          | Phase 05  | PARTIALLY CONFIRMED         |
| V-08 | Official contact email                                                                                                                                                                                    | Contact page, footer, enquiry routing | **asraacademy1@gmail.com** (supplied 2026-10-12)                                                                               | Phase 05  | CONFIRMED                   |

## W. Deployment

| ID   | Question                                                                                               | Why it matters                | Current assumption                            | Needed by | Status                      |
| ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------- | --------- | --------------------------- |
| W-01 | Hosting for the web app and API (e.g. Vercel + Render/Railway/Fly, or a VPS/cloud provider)?           | CI/CD and environment setup   | Pending; app is host-agnostic                 | Phase 15  | PENDING CLIENT CONFIRMATION |
| W-02 | Neon account ownership — academy or Marvel's Techworks — and plan/region?                              | Credentials handover and cost | Region closest to India (e.g. Singapore)      | Phase 02  | PENDING CLIENT CONFIRMATION |
| W-03 | Production Redis provider (e.g. Upstash, Redis Cloud, self-hosted)?                                    | Background jobs               | Configurable via `REDIS_URL`                  | Phase 11  | PENDING CLIENT CONFIRMATION |
| W-04 | Domain DNS access for www.asraacademy.in, and is an existing website live there that must be migrated? | Go-live and SEO redirects     | Client provides DNS access                    | Phase 15  | PENDING CLIENT CONFIRMATION |
| W-05 | Backup frequency/retention and maintenance window expectations?                                        | Order §4 backup/maintenance   | Daily backups, 7–30 day retention (Neon PITR) | Phase 15  | PENDING CLIENT CONFIRMATION |
| W-06 | Is a staging environment required for client UAT?                                                      | Environment count             | Yes                                           | Phase 14  | PENDING CLIENT CONFIRMATION |

## X. Other Dependencies

| ID   | Question                                                                        | Why it matters                    | Current assumption                            | Needed by   | Status                      |
| ---- | ------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- | ----------- | --------------------------- |
| X-01 | Is a mobile application required now or later?                                  | Mentioned only in §7 (commercial) | Not in scope; API is mobile-ready             | —           | PENDING CLIENT CONFIRMATION |
| X-02 | Is student–faculty messaging / doubt-clearing required?                         | Not stated in Order               | Not in scope                                  | Phase 08    | PENDING CLIENT CONFIRMATION |
| X-03 | Are testimonials, blog, events or gallery sections required on the public site? | Public website scope              | Testimonials section only if content supplied | Phase 05    | PENDING CLIENT CONFIRMATION |
| X-04 | Expected student volume at launch and in 12 months?                             | Capacity planning                 | Unknown                                       | Phase 13    | PENDING CLIENT CONFIRMATION |
| X-05 | Single point of contact on the academy side for approvals?                      | Turnaround on clarifications      | —                                             | Immediately | PENDING CLIENT CONFIRMATION |
| X-06 | Admin training format (live session, recorded videos, written manual)?          | Order §6 deliverable              | Live session + written guide                  | Phase 16    | PENDING CLIENT CONFIRMATION |
