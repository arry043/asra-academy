# ASRA Academy — Requirements Matrix

Version 0.1.0 · Internal IDs assigned by Marvel's Techworks (not taken from the client document).

**Priority:** MUST · SHOULD · FUTURE
**Source:** `Order §n` = client Project Development Order section · `Design` = client visual reference · `Tech Rec` = Marvel's Techworks technical recommendation
**Status:** CONFIRMED · PENDING CLIENT CONFIRMATION · PROPOSED (technical recommendation awaiting acknowledgement) · DONE (Phase 01 foundation)

See [SRS.md](./SRS.md) for detail and [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) for open questions.

## PUBLIC WEBSITE

| ID          | Requirement                                         | Priority | Source            | Status                           |
| ----------- | --------------------------------------------------- | -------- | ----------------- | -------------------------------- |
| REQ-PUB-001 | Home page                                           | MUST     | Order §5 + Design | CONFIRMED                        |
| REQ-PUB-002 | About ASRA Academy page                             | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-003 | Classes 6–10 page                                   | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-004 | Classes 11–12 page                                  | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-005 | English Language page                               | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-006 | Entrepreneurship & Business page                    | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-007 | Quranic Studies page                                | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-008 | Arabic and Urdu Courses page                        | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-009 | Faculty page                                        | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-010 | Admission and Enrolment page                        | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-011 | Student Login page                                  | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-012 | Contact Us page                                     | MUST     | Order §5          | CONFIRMED                        |
| REQ-PUB-013 | Privacy Policy page                                 | MUST     | Order §5          | CONFIRMED (text pending)         |
| REQ-PUB-014 | Terms and Conditions page                           | MUST     | Order §5          | CONFIRMED (text pending)         |
| REQ-PUB-015 | Refund Policy page                                  | MUST     | Order §5          | CONFIRMED (text pending)         |
| REQ-PUB-016 | Green + Gold ASRA branding, modern card-based UI    | MUST     | Order §4 + Design | CONFIRMED (brand assets pending) |
| REQ-PUB-017 | Page copy, images and legal text supplied by client | MUST     | Order §5          | PENDING CLIENT CONFIRMATION      |

## STUDENT

| ID          | Requirement                                    | Priority | Source   | Status                      |
| ----------- | ---------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-STU-001 | Student registration                           | MUST     | Order §3 | CONFIRMED                   |
| REQ-STU-002 | Secure login                                   | MUST     | Order §3 | CONFIRMED                   |
| REQ-STU-003 | Class/course-wise dashboard                    | MUST     | Order §3 | CONFIRMED                   |
| REQ-STU-004 | Progress tracking & exam results               | MUST     | Order §3 | CONFIRMED                   |
| REQ-STU-005 | Enrolment & payment history                    | MUST     | Order §3 | CONFIRMED                   |
| REQ-STU-006 | Registration fields & verification (email/OTP) | MUST     | Order §3 | PENDING CLIENT CONFIRMATION |
| REQ-STU-007 | Guardian details/consent for minors            | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |

## FACULTY

| ID          | Requirement                                  | Priority | Source   | Status                      |
| ----------- | -------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-FAC-001 | Faculty profiles                             | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-002 | Subject allocation                           | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-003 | Upload recorded lectures, notes, assignments | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-004 | Schedule live classes                        | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-005 | Review submissions/results                   | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-006 | Monitor student performance                  | MUST     | Order §3 | CONFIRMED                   |
| REQ-FAC-007 | Faculty can author quizzes/exams             | SHOULD   | Tech Rec | PENDING CLIENT CONFIRMATION |

## ADMIN

| ID          | Requirement                                             | Priority | Source   | Status                          |
| ----------- | ------------------------------------------------------- | -------- | -------- | ------------------------------- |
| REQ-ADM-001 | Manage students, teachers, classes, courses, enrolments | MUST     | Order §3 | CONFIRMED                       |
| REQ-ADM-002 | Manage course pricing & payment records                 | MUST     | Order §3 | CONFIRMED                       |
| REQ-ADM-003 | Manage live-class schedules & learning content          | MUST     | Order §3 | CONFIRMED                       |
| REQ-ADM-004 | Notifications & announcements                           | MUST     | Order §3 | CONFIRMED                       |
| REQ-ADM-005 | Reporting                                               | MUST     | Order §3 | CONFIRMED (report list pending) |
| REQ-ADM-006 | Certificates                                            | MUST     | Order §3 | CONFIRMED (rules pending)       |
| REQ-ADM-007 | Promotional offers                                      | MUST     | Order §3 | CONFIRMED (rules pending)       |
| REQ-ADM-008 | Admin sub-roles & permissions                           | SHOULD   | Tech Rec | PENDING CLIENT CONFIRMATION     |
| REQ-ADM-009 | Administrator training                                  | MUST     | Order §6 | CONFIRMED                       |

## ACADEMIC

| ID          | Requirement                                                | Priority | Source        | Status                      |
| ----------- | ---------------------------------------------------------- | -------- | ------------- | --------------------------- |
| REQ-ACA-001 | Final subject list                                         | MUST     | Order §2A     | PENDING CLIENT CONFIRMATION |
| REQ-ACA-002 | Classes 6–10, CBSE pattern                                 | MUST     | Order §2A     | CONFIRMED                   |
| REQ-ACA-003 | Classes 11–12 subject-specific coaching by stream          | MUST     | Order §2A     | CONFIRMED                   |
| REQ-ACA-004 | Stream list for Classes 11–12                              | MUST     | Order §2A     | PENDING CLIENT CONFIRMATION |
| REQ-ACA-005 | Chapter-wise lectures, notes, assignments, practice, exams | MUST     | Order §2A     | CONFIRMED                   |
| REQ-ACA-006 | Data-driven academic hierarchy (no hard-coding)            | MUST     | Order §2A, §4 | CONFIRMED                   |

## COURSES

| ID          | Requirement                               | Priority | Source    | Status                      |
| ----------- | ----------------------------------------- | -------- | --------- | --------------------------- |
| REQ-CRS-001 | English Language course                   | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-002 | Entrepreneurship & Business course        | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-003 | Quranic Studies course                    | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-004 | Arabic Language course                    | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-005 | Urdu Language course                      | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-006 | Add future courses without code changes   | MUST     | Order §2B | CONFIRMED                   |
| REQ-CRS-007 | Course levels, duration, batches, pricing | MUST     | Order §2B | PENDING CLIENT CONFIRMATION |

## CONTENT

| ID          | Requirement                                  | Priority | Source   | Status                      |
| ----------- | -------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-CNT-001 | Recorded lectures                            | MUST     | Order §3 | CONFIRMED                   |
| REQ-CNT-002 | Downloadable notes, PDFs, study materials    | MUST     | Order §3 | CONFIRMED                   |
| REQ-CNT-003 | Video hosting provider & download protection | MUST     | Order §3 | PENDING CLIENT CONFIRMATION |
| REQ-CNT-004 | Provider-independent storage abstraction     | MUST     | Tech Rec | PROPOSED                    |

## LIVE CLASSES

| ID          | Requirement                                     | Priority | Source   | Status                      |
| ----------- | ----------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-LIV-001 | Live online classes                             | MUST     | Order §3 | CONFIRMED                   |
| REQ-LIV-002 | Integration with a suitable live-class solution | MUST     | Order §4 | CONFIRMED                   |
| REQ-LIV-003 | Live-class provider selection                   | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-LIV-004 | LiveClassProvider adapter                       | MUST     | Tech Rec | PROPOSED                    |
| REQ-LIV-005 | Recording auto-publish, attendance              | SHOULD   | Tech Rec | PENDING CLIENT CONFIRMATION |

## ASSESSMENTS

| ID          | Requirement                                     | Priority | Source    | Status                      |
| ----------- | ----------------------------------------------- | -------- | --------- | --------------------------- |
| REQ-ASM-001 | Online quizzes                                  | MUST     | Order §3  | CONFIRMED                   |
| REQ-ASM-002 | Assignments (upload, submit, review)            | MUST     | Order §3  | CONFIRMED                   |
| REQ-ASM-003 | Mock tests and examinations                     | MUST     | Order §3  | CONFIRMED                   |
| REQ-ASM-004 | Practice questions                              | MUST     | Order §2A | CONFIRMED                   |
| REQ-ASM-005 | Examination results                             | MUST     | Order §3  | CONFIRMED                   |
| REQ-ASM-006 | Question types, timing, attempts, grading rules | MUST     | Order §3  | PENDING CLIENT CONFIRMATION |

## PAYMENTS

| ID          | Requirement                                    | Priority | Source   | Status                      |
| ----------- | ---------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-PAY-001 | Secure payment gateway if paid courses enabled | MUST     | Order §4 | CONFIRMED                   |
| REQ-PAY-002 | Payment gateway selection                      | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-PAY-003 | Promotional offers                             | MUST     | Order §3 | CONFIRMED (rules pending)   |
| REQ-PAY-004 | Invoice/GST requirements                       | SHOULD   | Tech Rec | PENDING CLIENT CONFIRMATION |
| REQ-PAY-005 | Refund workflow & policy text                  | MUST     | Order §5 | PENDING CLIENT CONFIRMATION |
| REQ-PAY-006 | PaymentProvider adapter + webhook verification | MUST     | Tech Rec | PROPOSED                    |

## ENROLMENT

| ID          | Requirement                                      | Priority | Source   | Status                      |
| ----------- | ------------------------------------------------ | -------- | -------- | --------------------------- |
| REQ-ENR-001 | Course enrolment by students                     | MUST     | Order §3 | CONFIRMED                   |
| REQ-ENR-002 | Admin manages enrolments                         | MUST     | Order §3 | CONFIRMED                   |
| REQ-ENR-003 | Admission approval workflow & enrolment validity | SHOULD   | Tech Rec | PENDING CLIENT CONFIRMATION |

## CERTIFICATES

| ID          | Requirement                                | Priority | Source   | Status                      |
| ----------- | ------------------------------------------ | -------- | -------- | --------------------------- |
| REQ-CRT-001 | Certificate management                     | MUST     | Order §3 | CONFIRMED                   |
| REQ-CRT-002 | Eligibility rules, template, which courses | MUST     | Order §3 | PENDING CLIENT CONFIRMATION |
| REQ-CRT-003 | Public certificate verification            | FUTURE   | Tech Rec | PROPOSED                    |

## NOTIFICATIONS

| ID          | Requirement              | Priority | Source   | Status                      |
| ----------- | ------------------------ | -------- | -------- | --------------------------- |
| REQ-NTF-001 | Email notifications      | MUST     | Order §4 | CONFIRMED                   |
| REQ-NTF-002 | Announcements            | MUST     | Order §3 | CONFIRMED                   |
| REQ-NTF-003 | Email provider selection | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-NTF-004 | Notification event list  | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-NTF-005 | In-app notifications     | SHOULD   | Tech Rec | PROPOSED                    |

## COMMUNICATION

| ID          | Requirement                                               | Priority | Source   | Status                      |
| ----------- | --------------------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-COM-001 | WhatsApp enquiry integration                              | MUST     | Order §4 | CONFIRMED                   |
| REQ-COM-002 | WhatsApp integration type (link vs Business API) & number | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-COM-003 | Contact Us page / enquiry form                            | MUST     | Order §5 | CONFIRMED                   |

## SEO

| ID          | Requirement                                         | Priority | Source   | Status    |
| ----------- | --------------------------------------------------- | -------- | -------- | --------- |
| REQ-SEO-001 | Search-engine-friendly structure                    | MUST     | Order §4 | CONFIRMED |
| REQ-SEO-002 | SSR/SSG, metadata, sitemap, robots, structured data | MUST     | Tech Rec | PROPOSED  |
| REQ-SEO-003 | Course/catalogue search                             | SHOULD   | Tech Rec | PROPOSED  |

## SECURITY

| ID          | Requirement                                            | Priority | Source   | Status                                                       |
| ----------- | ------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------ |
| REQ-SEC-001 | Secure authentication                                  | MUST     | Order §4 | CONFIRMED                                                    |
| REQ-SEC-002 | Student privacy & safeguards for minors                | MUST     | Order §4 | CONFIRMED (measures pending)                                 |
| REQ-SEC-003 | JWT + bcrypt, server-side RBAC                         | MUST     | Tech Rec | PROPOSED                                                     |
| REQ-SEC-004 | Helmet, CORS allow-list, Zod validation, rate limiting | MUST     | Tech Rec | DONE (Helmet, CORS, env validation) / rate limiting Phase 03 |
| REQ-SEC-005 | No secrets in source control                           | MUST     | Tech Rec | DONE                                                         |
| REQ-SEC-006 | DPDP Act 2023 compliance review                        | MUST     | Tech Rec | PENDING CLIENT CONFIRMATION                                  |
| REQ-SEC-007 | Audit logging of sensitive admin actions               | SHOULD   | Tech Rec | PROPOSED                                                     |

## INFRASTRUCTURE

| ID          | Requirement                                          | Priority | Source   | Status                      |
| ----------- | ---------------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-INF-001 | Monorepo (npm workspaces): web, api, packages        | MUST     | Tech Rec | DONE                        |
| REQ-INF-002 | Next.js + TypeScript + Tailwind + shadcn/ui          | MUST     | Tech Rec | DONE                        |
| REQ-INF-003 | Express + TypeScript API with /api/v1/health         | MUST     | Tech Rec | DONE                        |
| REQ-INF-004 | PostgreSQL + Prisma; Neon production                 | MUST     | Tech Rec | DONE (foundation)           |
| REQ-INF-005 | Docker Compose: PostgreSQL + Redis for local         | MUST     | Tech Rec | DONE                        |
| REQ-INF-006 | CI: install, lint, typecheck, build, Prisma validate | MUST     | Tech Rec | DONE                        |
| REQ-INF-007 | Backup, maintenance & support arrangements           | MUST     | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-INF-008 | Domain, hosting & deployment target                  | MUST     | Order §6 | PENDING CLIENT CONFIRMATION |
| REQ-INF-009 | Source code & deployment documentation               | MUST     | Order §6 | CONFIRMED                   |

## SCALABILITY

| ID          | Requirement                                                | Priority | Source   | Status                      |
| ----------- | ---------------------------------------------------------- | -------- | -------- | --------------------------- |
| REQ-SCL-001 | Add courses, languages, faculty, students as academy grows | MUST     | Order §4 | CONFIRMED                   |
| REQ-SCL-002 | Responsive on mobile, tablet, desktop                      | MUST     | Order §4 | CONFIRMED                   |
| REQ-SCL-003 | Stateless API, background jobs, CDN media                  | SHOULD   | Tech Rec | PROPOSED                    |
| REQ-SCL-004 | Multi-language UI (Hindi/Urdu/Arabic, RTL)                 | FUTURE   | Order §4 | PENDING CLIENT CONFIRMATION |
| REQ-SCL-005 | Mobile application                                         | FUTURE   | —        | PENDING CLIENT CONFIRMATION |
