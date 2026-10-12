# ASRA Academy — Software Requirements Specification (SRS)

| Field    | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Version  | 0.1.0                                                                       |
| Status   | Requirement Freeze — Baseline                                               |
| Sources  | Client Project Development Order (§1–6, §8); client visual design reference |
| Excluded | §7 Commercial Proposal Requested                                            |

## Conventions

**Priority**

| Label                 | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| **MUST HAVE**         | Explicitly stated by the client; required for launch               |
| **SHOULD HAVE**       | Implied by client statements or needed to deliver a MUST item well |
| **FUTURE / OPTIONAL** | Mentioned as future growth, or not committed for launch            |

**Origin tags**

- `[Client]` — stated in the Project Development Order (section number given).
- `[Technical Recommendation]` — proposed by Marvel's Techworks; **not** a confirmed client requirement.
- `[Pending]` — depends on an open item in [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md).

Requirement IDs (`FR-*`, `NFR-*`) are internal to Marvel's Techworks and cross-reference [REQUIREMENTS.md](./REQUIREMENTS.md).

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements of the ASRA Academy website and Learning Management System, establishing an engineering baseline for design, implementation, testing and acceptance.

### 1.2 Intended audience

Marvel's Techworks engineering, QA and project management; ASRA Academy stakeholders reviewing scope.

### 1.3 Definitions

| Term           | Definition                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| LMS            | Learning Management System                                                  |
| Program        | Top-level offering: School Education or Special Courses                     |
| Class          | School grade (6–12)                                                         |
| Stream         | Class 11–12 academic stream (e.g. Science/Commerce/Arts) — list pending     |
| Course         | An enrollable unit of learning (a subject for a class, or a special course) |
| Chapter/Module | Subdivision of a course                                                     |
| Lesson         | Single learning item (video, note, PDF, practice set)                       |
| RBAC           | Role-Based Access Control                                                   |
| Minor          | A student under 18 years of age                                             |

## 2. Scope

The system comprises:

1. A public, SEO-friendly website (15 required pages).
2. A Student Portal.
3. A Faculty Portal.
4. An Admin Dashboard.
5. A REST API backend with a PostgreSQL database.
6. Integrations: payment gateway (if paid courses enabled), live-class solution, email, WhatsApp enquiry, file/video storage.

Out of scope: commercial terms (§7); mobile applications (FUTURE / OPTIONAL, unconfirmed).

## 3. System Overview

```
Browser (mobile / tablet / desktop)
        │
        ▼
Next.js web application  ── public website, student, faculty and admin UIs
        │  HTTPS / REST (JSON)
        ▼
Express.js API (modular monolith)
        │
        ├── Service layer ── provider adapters (payment, live class, storage, email, WhatsApp)
        │
        ▼
Prisma ORM ──► PostgreSQL (Neon in production; Docker locally)
Redis + BullMQ (background jobs — later phases)
```

Full detail: [ARCHITECTURE.md](./ARCHITECTURE.md).

## 4. User Roles

| Role            | Status                               | Description                                              |
| --------------- | ------------------------------------ | -------------------------------------------------------- |
| Guest/Visitor   | `[Client §5]`                        | Unauthenticated user of the public website               |
| Student         | `[Client §3]`                        | Registered learner                                       |
| Faculty         | `[Client §3]`                        | Teacher allocated to subjects/courses                    |
| Admin           | `[Client §3]`                        | Academy administrator                                    |
| Super Admin     | `[Technical Recommendation]`         | Platform owner able to manage admins and system settings |
| Parent/Guardian | `[Pending]` CLIENT-CLARIFICATIONS §E | Possibly linked to minor students; login not confirmed   |

Granular admin sub-roles (e.g. accounts, content manager) are `[Pending]` (CLIENT-CLARIFICATIONS §S).

## 5. Functional Requirements — Summary

Functional requirements are detailed per area in sections 7–26. Every area maps to a category in REQUIREMENTS.md.

## 6. Non-Functional Requirements — Summary

| ID      | Requirement                                                                                     | Priority    | Origin                                       |
| ------- | ----------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------- |
| NFR-001 | Responsive on mobile phones, tablets and computers                                              | MUST HAVE   | `[Client §4]`                                |
| NFR-002 | Professional, modern UI with ASRA branding                                                      | MUST HAVE   | `[Client §4]`                                |
| NFR-003 | Search-engine-friendly structure                                                                | MUST HAVE   | `[Client §4]`                                |
| NFR-004 | Secure authentication and student privacy, safeguards for minors                                | MUST HAVE   | `[Client §4]`                                |
| NFR-005 | Scalable to add courses, languages, faculty and students                                        | MUST HAVE   | `[Client §4]`                                |
| NFR-006 | Backup and maintenance arrangements                                                             | MUST HAVE   | `[Client §4]`                                |
| NFR-007 | Accessible and user-friendly                                                                    | MUST HAVE   | `[Client §1]`                                |
| NFR-008 | Public pages achieve good Core Web Vitals (target Lighthouse ≥ 90 performance/SEO on key pages) | SHOULD HAVE | `[Technical Recommendation]`                 |
| NFR-009 | WCAG 2.1 AA as accessibility target                                                             | SHOULD HAVE | `[Technical Recommendation]`                 |
| NFR-010 | API p95 latency < 500 ms for standard reads under expected load                                 | SHOULD HAVE | `[Technical Recommendation]`                 |
| NFR-011 | Daily automated database backups with tested restore                                            | SHOULD HAVE | `[Technical Recommendation]` refines NFR-006 |

## 7. Authentication Requirements

| ID          | Requirement                                                        | Priority          | Origin                                                            |
| ----------- | ------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------- |
| FR-AUTH-001 | Student registration                                               | MUST HAVE         | `[Client §3]`                                                     |
| FR-AUTH-002 | Secure login for students, faculty and admins                      | MUST HAVE         | `[Client §3, §4]`                                                 |
| FR-AUTH-003 | Passwords hashed with bcrypt; never stored or logged in plain text | MUST HAVE         | `[Technical Recommendation]` implementing "secure authentication" |
| FR-AUTH-004 | JWT-based session tokens (short-lived access + refresh)            | MUST HAVE         | `[Technical Recommendation]` (locked stack)                       |
| FR-AUTH-005 | Password reset via email                                           | SHOULD HAVE       | `[Technical Recommendation]`                                      |
| FR-AUTH-006 | Email verification at registration                                 | SHOULD HAVE       | `[Pending]` §D                                                    |
| FR-AUTH-007 | Phone/OTP login or verification                                    | FUTURE / OPTIONAL | `[Pending]` §D                                                    |
| FR-AUTH-008 | Login rate limiting / brute-force protection                       | MUST HAVE         | `[Technical Recommendation]`                                      |
| FR-AUTH-009 | Faculty/admin accounts created by admins (no public sign-up)       | SHOULD HAVE       | `[Technical Recommendation]`                                      |

## 8. Authorization / RBAC Requirements

| ID          | Requirement                                                          | Priority    | Origin                             |
| ----------- | -------------------------------------------------------------------- | ----------- | ---------------------------------- |
| FR-RBAC-001 | Access to portals restricted by role (Student / Faculty / Admin)     | MUST HAVE   | `[Client §3]` implied              |
| FR-RBAC-002 | Authorization enforced server-side on every API request              | MUST HAVE   | `[Technical Recommendation]`       |
| FR-RBAC-003 | Faculty can only manage content for their allocated subjects/courses | MUST HAVE   | `[Client §3]` "subject allocation" |
| FR-RBAC-004 | Students can only access courses they are enrolled in (paid content) | MUST HAVE   | `[Technical Recommendation]`       |
| FR-RBAC-005 | Permission-based model to support future admin sub-roles             | SHOULD HAVE | `[Pending]` §S                     |

## 9. Student Requirements

| ID         | Requirement                                                   | Priority    | Origin                            |
| ---------- | ------------------------------------------------------------- | ----------- | --------------------------------- |
| FR-STU-001 | Class/course-wise dashboard                                   | MUST HAVE   | `[Client §3]`                     |
| FR-STU-002 | Access live online classes                                    | MUST HAVE   | `[Client §3]`                     |
| FR-STU-003 | Watch recorded lectures                                       | MUST HAVE   | `[Client §3]`                     |
| FR-STU-004 | Download notes, PDFs and study materials                      | MUST HAVE   | `[Client §3]`                     |
| FR-STU-005 | Take online quizzes, assignments, mock tests and examinations | MUST HAVE   | `[Client §3]`                     |
| FR-STU-006 | View progress tracking and examination results                | MUST HAVE   | `[Client §3]`                     |
| FR-STU-007 | View course enrolment and payment history                     | MUST HAVE   | `[Client §3]`                     |
| FR-STU-008 | Manage own profile                                            | SHOULD HAVE | `[Technical Recommendation]`      |
| FR-STU-009 | Receive announcements/notifications in-portal                 | SHOULD HAVE | `[Client §3]` admin announcements |

## 10. Faculty Requirements

| ID         | Requirement                                              | Priority          | Origin                                       |
| ---------- | -------------------------------------------------------- | ----------------- | -------------------------------------------- |
| FR-FAC-001 | Faculty profiles (also displayed on public Faculty page) | MUST HAVE         | `[Client §3, §5]`                            |
| FR-FAC-002 | Subject allocation                                       | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-003 | Upload recorded lectures                                 | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-004 | Upload notes and assignments                             | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-005 | Schedule live classes                                    | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-006 | Review student submissions and results                   | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-007 | Monitor student performance                              | MUST HAVE         | `[Client §3]`                                |
| FR-FAC-008 | Create quizzes/exams                                     | SHOULD HAVE       | `[Pending]` §J, §K (who authors assessments) |
| FR-FAC-009 | Content published only after admin approval              | FUTURE / OPTIONAL | `[Pending]` §T                               |

## 11. Admin Requirements

| ID         | Requirement                         | Priority    | Origin                                    |
| ---------- | ----------------------------------- | ----------- | ----------------------------------------- |
| FR-ADM-001 | Manage students                     | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-002 | Manage teachers (faculty)           | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-003 | Manage classes                      | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-004 | Manage courses                      | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-005 | Manage enrolments                   | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-006 | Manage course pricing               | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-007 | Manage payment records              | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-008 | Manage live-class schedules         | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-009 | Manage learning content             | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-010 | Notifications and announcements     | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-011 | Reporting                           | MUST HAVE   | `[Client §3]` (report list pending)       |
| FR-ADM-012 | Certificates                        | MUST HAVE   | `[Client §3]`                             |
| FR-ADM-013 | Promotional offers                  | MUST HAVE   | `[Client §3]` (offer rules pending §M)    |
| FR-ADM-014 | Manage admin users                  | SHOULD HAVE | `[Technical Recommendation]`              |
| FR-ADM-015 | Training for academy administrators | MUST HAVE   | `[Client §6]` (deliverable, not software) |

## 12. Academic Structure Requirements

| ID         | Requirement                                                                             | Priority          | Origin                                        |
| ---------- | --------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| FR-ACA-001 | Support Classes 6–10 (CBSE pattern)                                                     | MUST HAVE         | `[Client §2A]`                                |
| FR-ACA-002 | Support Classes 11–12 with subject-specific coaching per stream                         | MUST HAVE         | `[Client §2A]`                                |
| FR-ACA-003 | Subjects, classes and streams are data-driven, not hard-coded                           | MUST HAVE         | `[Client §2A]` "final list will be confirmed" |
| FR-ACA-004 | Chapter-wise organisation of lectures, notes, assignments, practice questions and exams | MUST HAVE         | `[Client §2A]`                                |
| FR-ACA-005 | Final subject list per class/stream                                                     | MUST HAVE         | `[Pending]` §A                                |
| FR-ACA-006 | Support boards other than CBSE                                                          | FUTURE / OPTIONAL | `[Pending]` §A                                |

## 13. Course Requirements

| ID         | Requirement                                                                                                     | Priority    | Origin                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------- |
| FR-CRS-001 | Special courses: English Language, Entrepreneurship & Business, Quranic Studies, Arabic Language, Urdu Language | MUST HAVE   | `[Client §2B]`                              |
| FR-CRS-002 | Add new academic, professional and skill-development courses without code changes                               | MUST HAVE   | `[Client §2B, §4]`                          |
| FR-CRS-003 | Courses can be free or paid                                                                                     | MUST HAVE   | `[Client §4]` "if paid courses are enabled" |
| FR-CRS-004 | Course detail pages on the public website                                                                       | MUST HAVE   | `[Client §5]`                               |
| FR-CRS-005 | Course levels, duration, batches                                                                                | SHOULD HAVE | `[Pending]` §B                              |

## 14. Learning Content Requirements

| ID         | Requirement                                                  | Priority    | Origin                       |
| ---------- | ------------------------------------------------------------ | ----------- | ---------------------------- |
| FR-CNT-001 | Recorded video lectures                                      | MUST HAVE   | `[Client §3]`                |
| FR-CNT-002 | Downloadable notes/PDFs/study materials                      | MUST HAVE   | `[Client §3]`                |
| FR-CNT-003 | Practice questions per chapter                               | MUST HAVE   | `[Client §2A]`               |
| FR-CNT-004 | Content storage via provider-independent storage abstraction | MUST HAVE   | `[Technical Recommendation]` |
| FR-CNT-005 | Video hosting provider and protection (download prevention)  | SHOULD HAVE | `[Pending]` §G               |
| FR-CNT-006 | Signed/expiring URLs for private files                       | SHOULD HAVE | `[Technical Recommendation]` |

## 15. Live Class Requirements

| ID         | Requirement                                             | Priority          | Origin                       |
| ---------- | ------------------------------------------------------- | ----------------- | ---------------------------- |
| FR-LIV-001 | Integration with a suitable live-class solution         | MUST HAVE         | `[Client §4]`                |
| FR-LIV-002 | Faculty schedule live classes; admins manage schedules  | MUST HAVE         | `[Client §3]`                |
| FR-LIV-003 | Students join live classes from their dashboard         | MUST HAVE         | `[Client §3]`                |
| FR-LIV-004 | Provider-independent `LiveClassProvider` adapter        | MUST HAVE         | `[Technical Recommendation]` |
| FR-LIV-005 | Recordings automatically published as recorded lectures | FUTURE / OPTIONAL | `[Pending]` §F               |
| FR-LIV-006 | Attendance tracking                                     | SHOULD HAVE       | `[Pending]` §F               |

## 16. Assignment Requirements

| ID         | Requirement                                                 | Priority    | Origin         |
| ---------- | ----------------------------------------------------------- | ----------- | -------------- |
| FR-ASG-001 | Faculty upload assignments                                  | MUST HAVE   | `[Client §3]`  |
| FR-ASG-002 | Students complete/submit assignments online                 | MUST HAVE   | `[Client §3]`  |
| FR-ASG-003 | Faculty review submissions and record results               | MUST HAVE   | `[Client §3]`  |
| FR-ASG-004 | Due dates, late submission rules, file types, grading scale | SHOULD HAVE | `[Pending]` §I |

## 17. Quiz Requirements

| ID         | Requirement                           | Priority    | Origin                       |
| ---------- | ------------------------------------- | ----------- | ---------------------------- |
| FR-QUZ-001 | Online quizzes                        | MUST HAVE   | `[Client §3]`                |
| FR-QUZ-002 | Practice questions                    | MUST HAVE   | `[Client §2A]`               |
| FR-QUZ-003 | Auto-grading for objective questions  | SHOULD HAVE | `[Technical Recommendation]` |
| FR-QUZ-004 | Question types, time limits, attempts | SHOULD HAVE | `[Pending]` §J               |

## 18. Examination Requirements

| ID         | Requirement                                    | Priority          | Origin         |
| ---------- | ---------------------------------------------- | ----------------- | -------------- |
| FR-EXM-001 | Online mock tests and examinations             | MUST HAVE         | `[Client §3]`  |
| FR-EXM-002 | Examination results visible to students        | MUST HAVE         | `[Client §3]`  |
| FR-EXM-003 | Scheduled exam windows and timed attempts      | SHOULD HAVE       | `[Pending]` §K |
| FR-EXM-004 | Result publication controlled by faculty/admin | SHOULD HAVE       | `[Pending]` §K |
| FR-EXM-005 | Online proctoring                              | FUTURE / OPTIONAL | `[Pending]` §K |

## 19. Progress Tracking Requirements

| ID         | Requirement                                                      | Priority          | Origin                                        |
| ---------- | ---------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| FR-PRG-001 | Students view progress per course                                | MUST HAVE         | `[Client §3]`                                 |
| FR-PRG-002 | Faculty monitor student performance                              | MUST HAVE         | `[Client §3]`                                 |
| FR-PRG-003 | Admin reporting across students/courses                          | MUST HAVE         | `[Client §3]`                                 |
| FR-PRG-004 | Progress calculation rule (lesson completion, assessment scores) | SHOULD HAVE       | `[Pending]` §A / `[Technical Recommendation]` |
| FR-PRG-005 | Parent/guardian progress view                                    | FUTURE / OPTIONAL | `[Pending]` §E                                |

## 20. Enrolment Requirements

| ID         | Requirement                                   | Priority    | Origin         |
| ---------- | --------------------------------------------- | ----------- | -------------- |
| FR-ENR-001 | Admission and Enrolment public page           | MUST HAVE   | `[Client §5]`  |
| FR-ENR-002 | Students enrol in courses                     | MUST HAVE   | `[Client §3]`  |
| FR-ENR-003 | Admins manage enrolments                      | MUST HAVE   | `[Client §3]`  |
| FR-ENR-004 | Enrolment history visible to students         | MUST HAVE   | `[Client §3]`  |
| FR-ENR-005 | Admission approval workflow (auto vs. manual) | SHOULD HAVE | `[Pending]` §D |
| FR-ENR-006 | Enrolment validity/expiry                     | SHOULD HAVE | `[Pending]` §B |

## 21. Payment Requirements

| ID         | Requirement                                                                                                    | Priority          | Origin                           |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------- |
| FR-PAY-001 | Secure payment gateway integration if paid courses are enabled                                                 | MUST HAVE         | `[Client §4]`                    |
| FR-PAY-002 | Admins manage course pricing and payment records                                                               | MUST HAVE         | `[Client §3]`                    |
| FR-PAY-003 | Students view payment history                                                                                  | MUST HAVE         | `[Client §3]`                    |
| FR-PAY-004 | Promotional offers (discounts/coupons)                                                                         | MUST HAVE         | `[Client §3]` (rules pending §M) |
| FR-PAY-005 | Refund Policy page                                                                                             | MUST HAVE         | `[Client §5]`                    |
| FR-PAY-006 | Provider-independent `PaymentProvider` adapter; webhook signature verification; server-side amount calculation | MUST HAVE         | `[Technical Recommendation]`     |
| FR-PAY-007 | Card data never stored on ASRA servers                                                                         | MUST HAVE         | `[Technical Recommendation]`     |
| FR-PAY-008 | Invoices/receipts, GST                                                                                         | SHOULD HAVE       | `[Pending]` §M                   |
| FR-PAY-009 | Refund processing workflow                                                                                     | SHOULD HAVE       | `[Pending]` §N                   |
| FR-PAY-010 | Instalment payments / subscriptions                                                                            | FUTURE / OPTIONAL | `[Pending]` §M                   |

## 22. Certificate Requirements

| ID         | Requirement                                       | Priority          | Origin                       |
| ---------- | ------------------------------------------------- | ----------------- | ---------------------------- |
| FR-CRT-001 | Admin manages certificates                        | MUST HAVE         | `[Client §3]`                |
| FR-CRT-002 | Certificate eligibility rules and template design | MUST HAVE         | `[Pending]` §L               |
| FR-CRT-003 | Generated as PDF and downloadable by student      | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-CRT-004 | Public verification by certificate ID/QR          | FUTURE / OPTIONAL | `[Technical Recommendation]` |

## 23. Notification Requirements

| ID         | Requirement                                                    | Priority          | Origin                       |
| ---------- | -------------------------------------------------------------- | ----------------- | ---------------------------- |
| FR-NTF-001 | Email notifications                                            | MUST HAVE         | `[Client §4]`                |
| FR-NTF-002 | Admin notifications and announcements                          | MUST HAVE         | `[Client §3]`                |
| FR-NTF-003 | In-app notifications                                           | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-NTF-004 | Notification events list (class reminders, results, payments…) | SHOULD HAVE       | `[Pending]` §O               |
| FR-NTF-005 | WhatsApp/SMS transactional notifications                       | FUTURE / OPTIONAL | `[Pending]` §P               |
| FR-NTF-006 | Delivery via background jobs (Redis + BullMQ) with retries     | SHOULD HAVE       | `[Technical Recommendation]` |

## 24. Communication Requirements

| ID         | Requirement                                       | Priority          | Origin                       |
| ---------- | ------------------------------------------------- | ----------------- | ---------------------------- |
| FR-COM-001 | WhatsApp enquiry integration                      | MUST HAVE         | `[Client §4]`                |
| FR-COM-002 | Contact Us page                                   | MUST HAVE         | `[Client §5]`                |
| FR-COM-003 | Contact/enquiry form stored and visible to admins | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-COM-004 | Student–faculty messaging / doubt resolution      | FUTURE / OPTIONAL | `[Pending]` §X               |

## 25. Search Requirements

| ID         | Requirement                                           | Priority          | Origin                       |
| ---------- | ----------------------------------------------------- | ----------------- | ---------------------------- |
| FR-SRC-001 | Course search/filter on public website                | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-SRC-002 | Admin search for students, faculty, courses, payments | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-SRC-003 | Dedicated search engine (beyond PostgreSQL full-text) | FUTURE / OPTIONAL | `[Technical Recommendation]` |

## 26. SEO Requirements

| ID         | Requirement                                          | Priority          | Origin                       |
| ---------- | ---------------------------------------------------- | ----------------- | ---------------------------- |
| FR-SEO-001 | Search-engine-friendly website structure             | MUST HAVE         | `[Client §4]`                |
| FR-SEO-002 | Server-rendered/static public pages                  | MUST HAVE         | `[Technical Recommendation]` |
| FR-SEO-003 | Per-page titles, descriptions, Open Graph metadata   | MUST HAVE         | `[Technical Recommendation]` |
| FR-SEO-004 | sitemap.xml, robots.txt, canonical URLs, clean slugs | MUST HAVE         | `[Technical Recommendation]` |
| FR-SEO-005 | Structured data (Organization, Course)               | SHOULD HAVE       | `[Technical Recommendation]` |
| FR-SEO-006 | Blog/articles                                        | FUTURE / OPTIONAL | Not requested by client      |

## 27. Security Requirements

| ID         | Requirement                                                    | Priority    | Origin                       |
| ---------- | -------------------------------------------------------------- | ----------- | ---------------------------- |
| FR-SEC-001 | HTTPS everywhere in production                                 | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-002 | Secure HTTP headers (Helmet), strict CORS                      | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-003 | Input validation on all API inputs (Zod)                       | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-004 | Secrets supplied via environment variables, never committed    | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-005 | Rate limiting on authentication and public form endpoints      | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-006 | Least-privilege database credentials in production             | SHOULD HAVE | `[Technical Recommendation]` |
| FR-SEC-007 | File upload validation (type, size, malware scanning optional) | MUST HAVE   | `[Technical Recommendation]` |
| FR-SEC-008 | Dependency vulnerability scanning in CI                        | SHOULD HAVE | `[Technical Recommendation]` |

## 28. Privacy Requirements

| ID         | Requirement                                                                                                          | Priority    | Origin                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| FR-PRV-001 | Student privacy protection                                                                                           | MUST HAVE   | `[Client §4]`                                                     |
| FR-PRV-002 | Appropriate safeguards for minors                                                                                    | MUST HAVE   | `[Client §4]` (specific measures pending §E)                      |
| FR-PRV-003 | Privacy Policy and Terms and Conditions pages                                                                        | MUST HAVE   | `[Client §5]` (text supplied by client)                           |
| FR-PRV-004 | Compliance with India's Digital Personal Data Protection Act, 2023 (verifiable parental consent for children's data) | MUST HAVE   | `[Technical Recommendation]` — legal review by client required §U |
| FR-PRV-005 | Data minimisation; student personal data not shown publicly                                                          | MUST HAVE   | `[Technical Recommendation]`                                      |
| FR-PRV-006 | Account/data deletion on request                                                                                     | SHOULD HAVE | `[Pending]` §U                                                    |

## 29. Scalability Requirements

| ID         | Requirement                                                   | Priority    | Origin                       |
| ---------- | ------------------------------------------------------------- | ----------- | ---------------------------- |
| FR-SCL-001 | Add courses, languages, faculty and students without redesign | MUST HAVE   | `[Client §4]`                |
| FR-SCL-002 | Stateless API enabling horizontal scaling                     | SHOULD HAVE | `[Technical Recommendation]` |
| FR-SCL-003 | Media served from object storage/CDN, not the API server      | SHOULD HAVE | `[Technical Recommendation]` |
| FR-SCL-004 | Background jobs for slow work (email, certificates, reports)  | SHOULD HAVE | `[Technical Recommendation]` |
| FR-SCL-005 | Pagination on all list endpoints                              | MUST HAVE   | `[Technical Recommendation]` |

## 30. Responsive Design Requirements

| ID         | Requirement                                                          | Priority  | Origin                       |
| ---------- | -------------------------------------------------------------------- | --------- | ---------------------------- |
| FR-RSP-001 | Responsive on mobile phones, tablets and computers                   | MUST HAVE | `[Client §4]`                |
| FR-RSP-002 | Mobile-first layouts; verified at ≥ 320 px, 768 px, 1024 px, 1280 px | MUST HAVE | `[Technical Recommendation]` |
| FR-RSP-003 | Consistent component system across breakpoints                       | MUST HAVE | Design reference             |

## 31. Error Handling Requirements

| ID         | Requirement                                                                            | Priority    | Origin                       |
| ---------- | -------------------------------------------------------------------------------------- | ----------- | ---------------------------- |
| FR-ERR-001 | Consistent API error envelope `{ success: false, message, error: { code, details? } }` | MUST HAVE   | `[Technical Recommendation]` |
| FR-ERR-002 | No stack traces or internals leaked in production responses                            | MUST HAVE   | `[Technical Recommendation]` |
| FR-ERR-003 | Friendly error pages (404, 500) on the web app                                         | MUST HAVE   | `[Technical Recommendation]` |
| FR-ERR-004 | Server-side error logging with request correlation IDs                                 | SHOULD HAVE | `[Technical Recommendation]` |

## 32. Audit Logging Requirements

| ID         | Requirement                                                                         | Priority    | Origin                       |
| ---------- | ----------------------------------------------------------------------------------- | ----------- | ---------------------------- |
| FR-AUD-001 | Audit log of admin actions on payments, pricing, results, enrolments and user roles | SHOULD HAVE | `[Technical Recommendation]` |
| FR-AUD-002 | Audit log of authentication events (login, failed login, password reset)            | SHOULD HAVE | `[Technical Recommendation]` |
| FR-AUD-003 | Audit records are append-only and admin-viewable                                    | SHOULD HAVE | `[Technical Recommendation]` |

## 33. External Integration Requirements

| Integration        | Requirement                                        | Priority    | Provider status    |
| ------------------ | -------------------------------------------------- | ----------- | ------------------ |
| Payment gateway    | If paid courses enabled                            | MUST HAVE   | `[Pending]` §M     |
| Live classes       | "Suitable live-class solution"                     | MUST HAVE   | `[Pending]` §F     |
| Email              | Email notifications                                | MUST HAVE   | `[Pending]` §Q     |
| WhatsApp           | Enquiry integration                                | MUST HAVE   | `[Pending]` §P     |
| File/video storage | Lectures, notes, PDFs, submissions                 | MUST HAVE   | `[Pending]` §G, §R |
| Database           | PostgreSQL — Neon (production)                     | MUST HAVE   | Locked             |
| Redis              | Background jobs — production provider configurable | SHOULD HAVE | `[Pending]` §W     |

All external providers are integrated behind adapter interfaces and configured through environment variables (see ARCHITECTURE.md §8).

## 34. Acceptance Criteria

Detailed acceptance criteria will be agreed per phase. Baseline criteria:

1. **Public website** — all 15 pages in §5 render on mobile/tablet/desktop, have unique SEO metadata, and are indexable.
2. **Registration & login** — a student can register, log in, log out and reset a password; unauthorised users cannot access portal routes or APIs.
3. **Academic structure** — an admin can create classes, streams, subjects and special courses without code changes.
4. **Learning** — an enrolled student can watch a recorded lecture, download permitted materials and join a scheduled live class.
5. **Assessments** — a student can attempt a quiz, submit an assignment and take an exam; faculty can review; results appear for the student.
6. **Progress** — student progress and results are visible to the student, allocated faculty and admins.
7. **Payments** (if enabled) — a student can pay for a paid course, enrolment activates only after verified payment, and the payment appears in student history and admin records.
8. **Notifications** — configured email notifications are delivered for the agreed events.
9. **WhatsApp enquiry** — visitors can start a WhatsApp enquiry from the website.
10. **Security** — passwords are hashed, secrets are not in source control, RBAC is enforced server-side.
11. **Responsiveness** — no horizontal scroll or broken layout at 320 px+.
12. **Handover** — deployment documentation delivered and administrators trained.
