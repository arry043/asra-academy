# ASRA Academy — Careers & Recruitment Management System

| Field      | Value                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Module     | Careers & Recruitment Management System (Phase 16)                                                     |
| Status     | Implementation Complete · Automated Verification Complete · Staging Ready                              |
| Authors    | ASRA Academy Engineering Team & Marvel's Techworks                                                     |
| API Router | `apps/api/src/modules/recruitment/recruitment.routes.ts`                                               |
| Web Routes | `/careers`, `/careers/[jobId]`, `/careers/[jobId]/apply`, `/admin/recruitment`, `/admin/recruitment/*` |

---

## 1. Architectural Overview

The **Careers & Recruitment Management System** is a standalone, production-grade module engineered directly into the existing ASRA Academy monorepo. It strictly adheres to all established architecture boundaries, design tokens, error-handling conventions, and security guardrails across `@asra/types`, `@asra/validation`, `@asra/api`, and `@asra/web`.

The system serves two completely segregated user experiences:

1. **Public Careers Portal (`/careers`):** An applicant-facing experience for browsing active vacancies, reviewing job descriptions, answering dynamic screening questions, securely uploading PDF resumes, and submitting applications. **Applicants never create an account, hold session tokens, or access any portal dashboard.** All applicant touchpoints are handled via automated, branded transactional emails.
2. **Admin Recruitment Dashboard (`/admin/recruitment`):** An administrative suite integrated into the ASRA Admin Shell for managing the job vacancy lifecycle, configuring screening questionnaires, reviewing incoming candidates, adding confidential evaluation notes, scheduling Google Meet interviews, and tracking pipeline metrics through real database aggregations.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC APPLICANTS                               │
│  - Browse /careers            - Dynamic Question Validation               │
│  - View /careers/[jobId]      - Secure PDF Upload (%PDF- magic byte)      │
│  - Apply /careers/[jobId]/apply (Guest Submission -> ASRA-APP-YYYY-XXXXX) │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
               HTTP Rate-Limited (recruitmentRateLimit)
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS.JS BACKEND API                              │
│  /api/v1/careers                    /api/v1/admin/recruitment             │
│  - Public Job Listing & Details     - Atomic Sequential ID Generator      │
│  - Dynamic Question Schema Check    - Multi-tenant Cloudinary/Local Disk  │
│  - Guest Resume Uploader            - Resend Branded Email Outbox Engine  │
│  - Strict Duplicate Prevention      - Admin RBAC (recruitment.manage)     │
└───────────────────┬─────────────────────────────────┬─────────────────────┘
                    │                                 │
     Prisma Client  │                                 │  Next.js Server /
     Database Layer ▼                                 │  Client Hydration
┌───────────────────────────────────────────────┐     │
│             POSTGRESQL DATABASE               │     ▼
│  - jobs                      - job_answers    │  ┌────────────────────────┐
│  - job_questions             - job_notes      │  │ ADMIN DASHBOARD        │
│  - job_applications          - job_interviews │  │ - Pipeline KPIs        │
│  - job_status_history        - job_comms      │  │ - Vacancy CRUD         │
│  - job_sequences             - app_sequences  │  │ - Candidate Evaluation │
└───────────────────────────────────────────────┘  │ - Meet Scheduling      │
                                                   └────────────────────────┘
```

---

## 2. Database Models & Schema Design

The recruitment subsystem introduces 10 dedicated relational tables in PostgreSQL managed via Prisma (`apps/api/prisma/schema.prisma`):

| Model                         | Table Name                       | Purpose                                                                                                | Key Constraints & Indexes                                                         |
| :---------------------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `JobSequence`                 | `job_sequences`                  | Year-based atomic counter for human-readable Job IDs (`ASRA-JOB-YYYY-XXXXX`).                          | `PRIMARY KEY (year)`                                                              |
| `ApplicationSequence`         | `application_sequences`          | Year-based atomic counter for human-readable Application Reference Numbers (`ASRA-APP-YYYY-XXXXX`).    | `PRIMARY KEY (year)`                                                              |
| `Job`                         | `jobs`                           | Core job posting record with compensation visibility, department, vacancies, requirements, and status. | `UNIQUE (job_id)`, `INDEX (status, is_active, application_deadline)`              |
| `JobApplicationQuestion`      | `job_application_questions`      | Dynamic screening questions assigned per job (types: text, select, boolean, number, date, url).        | `INDEX (job_id, display_order)`                                                   |
| `JobApplication`              | `job_applications`               | Submitted candidate profile, resume metadata, and recruitment workflow state.                          | `UNIQUE (application_id)`, `UNIQUE (job_id, email)`, `INDEX (status, created_at)` |
| `JobApplicationAnswer`        | `job_application_answers`        | Immutable candidate responses linked to specific questions, capturing frozen snapshot labels.          | `UNIQUE (application_id, question_id)`                                            |
| `JobApplicationStatusHistory` | `job_application_status_history` | Append-only audit log tracking every workflow transition, timestamp, and actor.                        | `INDEX (application_id, created_at)`                                              |
| `JobApplicationNote`          | `job_application_notes`          | Confidential internal evaluation notes, visible strictly to authorized staff.                          | `INDEX (application_id, created_at)`                                              |
| `JobInterview`                | `job_interviews`                 | Scheduled interviews containing Google Meet links, interviewers, timestamps, and outcomes.             | `INDEX (application_id, scheduled_at)`                                            |
| `JobApplicationCommunication` | `job_application_communications` | Outbox log of all transactional recruitment emails sent via Resend.                                    | `INDEX (application_id, sent_at)`                                                 |

### Enums

- **`JobDepartment`**: `ACADEMIC`, `ADMINISTRATION`, `TECHNOLOGY`, `STUDENT_SUPPORT`, `MARKETING`, `OPERATIONS`, `FINANCE`, `LEADERSHIP`
- **`JobCategory`**: `TEACHING_FACULTY`, `ACADEMIC_COORDINATION`, `CURRICULUM_DEVELOPMENT`, `SOFTWARE_ENGINEERING`, `IT_INFRASTRUCTURE`, `STUDENT_COUNSELLING`, `ADMISSIONS`, `CONTENT_CREATION`, `EXAMINATION_ASSESSMENT`, `GENERAL_ADMINISTRATION`
- **`JobEmploymentType`**: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `VISITING_FACULTY`, `INTERNSHIP`
- **`JobWorkArrangement`**: `ON_SITE`, `REMOTE`, `HYBRID`
- **`JobStatus`**: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `CLOSED`
- **`JobApplicationStatus`**: `NEW`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`
- **`JobQuestionType`**: `SHORT_TEXT`, `LONG_TEXT`, `SINGLE_SELECT`, `MULTI_SELECT`, `YES_NO`, `NUMBER`, `DATE`, `URL`
- **`InterviewFormat`**: `ONLINE`, `IN_PERSON`, `TELEPHONIC`
- **`RecruitmentEmailType`**: `APPLICATION_CONFIRMATION`, `STATUS_UPDATE`, `INTERVIEW_INVITATION`, `INTERVIEW_RESCHEDULE`, `INTERVIEW_REMINDER`, `INTERVIEW_CANCELLATION`, `REJECTION`, `OFFER_LETTER`, `GENERAL_COMMUNICATION`

---

## 3. Concurrency-Safe Sequential ID Generation

Both Job IDs (`ASRA-JOB-YYYY-XXXXX`) and Application IDs (`ASRA-APP-YYYY-XXXXX`) are generated using dedicated sequence tracking tables:

```sql
INSERT INTO job_sequences (year, current_number)
VALUES ($1, 1)
ON CONFLICT (year) DO UPDATE
SET current_number = job_sequences.current_number + 1
RETURNING current_number;
```

### Guarantees:

- **No Race Conditions:** PostgreSQL row-level locks prevent collision during high-concurrency job or application creation.
- **Year Partitioning:** Sequence numbers automatically reset on each new Gregorian calendar year.
- **Client Immobility:** Client payloads cannot specify or override generated IDs.
- **Idempotency:** Editing an existing job preserves its original ID indefinitely.

---

## 4. Resume Security & PDF Handling Pipeline

Candidate resumes are treated as sensitive, untrusted uploads requiring strict validation and access control:

1. **Pre-Flight Validation:**
   - Client and server enforce a hard **5 MB limit** (`MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024`).
   - Extension pre-check strictly requires `.pdf`.
2. **Binary Content & Magic-Byte Inspection:**
   - Server inspects the binary buffer for standard PDF magic bytes: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`).
   - Executable binaries, polyglot files, zip archives, and disguised scripts are rejected with HTTP 422 (`INVALID_FILE_TYPE`).
3. **Storage Abstraction:**
   - **Production:** Uploads directly to Cloudinary (`asra-academy/resumes`) with random UUID identifiers when `CLOUDINARY_API_KEY` is present.
   - **Local / Staging:** Secure local disk storage at `storage/resumes/<uuid>.pdf` with private file permissions (`0o600`), or memory-buffer caching in automated test suites.
4. **Tamper-Evident Tokens:**
   - Temporary file uploads return a tamper-proof HMAC-SHA256 signature containing `fileId`, `originalName`, and `fileSize`.
   - Modifying upload parameters on submission causes signature verification failure.
5. **Private Streaming Endpoint:**
   - Public URLs to resumes are **never** exposed in API responses or HTML.
   - Resumes can only be fetched by authenticated administrators with `recruitment.manage` via `GET /api/v1/admin/recruitment/applications/:id/resume`.
   - Streams bytes with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="..."`, and `Cache-Control: private, no-store`.

---

## 5. Dynamic Screening Question Engine

Admins can configure custom, job-specific screening questions to filter candidates effectively.

### Supported Question Types:

- `SHORT_TEXT`: Single-line text input (max 255 chars).
- `LONG_TEXT`: Multi-line text input (max 2000 chars).
- `SINGLE_SELECT`: Single choice from an admin-defined array of options.
- `MULTI_SELECT`: Multiple selections from an admin-defined array of options.
- `YES_NO`: Binary boolean selection (`Yes` / `No`).
- `NUMBER`: Integer or floating-point input with optional min/max validation.
- `DATE`: ISO 8601 date input.
- `URL`: Validated HTTP/HTTPS web address.

### Integrity & Immutability:

- **Server-Side Verification:** The server ignores submitted form structure and matches answers directly against active `JobApplicationQuestion` records in the database.
- **Option Restriction:** For select inputs, submitted values must match one of the stored question options.
- **Historical Snapshots:** When an application is submitted, `JobApplicationAnswer` persists `questionLabel`, `questionType`, and `optionsSnapshot`. If an administrator subsequently alters or deletes a question on the job, past application records remain completely untainted.

---

## 6. Duplicate Application & Abuse Prevention

1. **Database Constraint:**
   - `UNIQUE (job_id, email)` enforces that an applicant can only hold **one active submission per job posting**.
   - Attempting a duplicate submission returns HTTP 409 (`CONFLICT`) informing the applicant cleanly: _"You have already applied for this position."_
2. **Multi-Job Flexibility:**
   - Applicants can submit applications for different job postings without interference.
3. **Rate Limiting:**
   - `recruitmentRateLimit` restricts public submission to **10 requests per 15 minutes per IP**.
   - Resume upload endpoint is capped at **60 requests per 15 minutes per IP**.

---

## 7. Email Communication & Outbox Engine

All applicant interactions occur through transactional email powered by Resend:

| Template Name              | Trigger Event                 | Key Variables                                                                             |
| :------------------------- | :---------------------------- | :---------------------------------------------------------------------------------------- |
| `APPLICATION_CONFIRMATION` | Candidate submits application | Applicant Name, Job Title, Job ID, Reference Number                                       |
| `STATUS_UPDATE`            | Admin transitions status      | Applicant Name, Job Title, Reference Number, New Status, Remarks                          |
| `INTERVIEW_INVITATION`     | Admin schedules interview     | Applicant Name, Job Title, Scheduled Date/Time, Timezone, Format, Meet Link, Instructions |
| `INTERVIEW_RESCHEDULE`     | Admin reschedules interview   | Applicant Name, Job Title, New Date/Time, Meet Link, Reason                               |
| `INTERVIEW_REMINDER`       | Automated/manual reminder     | Applicant Name, Job Title, Scheduled Time, Meet Link                                      |
| `INTERVIEW_CANCELLATION`   | Admin cancels interview       | Applicant Name, Job Title, Cancellation Reason                                            |
| `REJECTION`                | Admin marks status `REJECTED` | Applicant Name, Job Title, Reference Number                                               |
| `OFFER_LETTER`             | Admin marks status `ACCEPTED` | Applicant Name, Job Title, Reference Number, Joining Instructions                         |
| `GENERAL_COMMUNICATION`    | Admin sends custom message    | Applicant Name, Job Title, Subject, Custom HTML/Text Body                                 |

### Visual Identity & Deliverability:

- Uses the unified `renderBrandedEmail` engine with the ASRA Academy navy (`#0B192C`) and gold (`#FFB703`) palette.
- All outbound emails are logged in `job_application_communications`.
- If the Resend API key is unconfigured or a network delivery error occurs, the failure is recorded without crashing the parent transaction.

---

## 8. Role-Based Access Control (RBAC)

- **Permission:** `recruitment.manage` (`recruitment.manage`)
- **Assigned Roles:** `ADMIN`, `SUPER_ADMIN`
- **Enforcement:** Applied globally to all routes mounted on `recruitmentAdminRouter` via:
  ```typescript
  router.use(authenticateUser, requirePermission('recruitment.manage'));
  ```
- Public endpoints (`/api/v1/careers/*`) require no authentication, allowing guest submissions.

---

## 9. API Specification

### Public Endpoints (`/api/v1/careers`)

- `GET /` or `GET /jobs`: Query active vacancies (supports `search`, `department`, `category`, `type`, `location`, `page`, `limit`).
- `GET /categories` or `GET /jobs/categories`: Query distinct categories currently hosting active, published vacancies (used by dynamic footer navigation; cached with 60s max-age).
- `GET /:jobId` or `GET /jobs/:jobId`: Retrieve public details and screening questions for a single published job.
- `POST /:jobId/apply` or `POST /jobs/:jobId/apply`: Submit guest application payload with answers and resume token.
- `POST /upload-resume`: Upload candidate resume PDF (multipart/form-data) and obtain HMAC token.

### Admin Endpoints (`/api/v1/admin/recruitment`)

- `GET /stats`: Retrieve pipeline metrics and department aggregations.
- `GET /jobs`: List all jobs with pagination and filter criteria.
- `POST /jobs`: Create a new job draft or published position.
- `GET /jobs/:id`: Fetch complete job details including questions and application count.
- `PATCH /jobs/:id`: Update job attributes and questions.
- `POST /jobs/:id/publish`: Publish a draft job.
- `POST /jobs/:id/unpublish`: Unpublish an active job.
- `DELETE /jobs/:id`: Soft delete / archive job posting.
- `GET /applications`: List applications (filter by `jobId`, `status`, `search`).
- `GET /applications/:id`: Fetch complete candidate profile, answers, notes, and communications.
- `PATCH /applications/:id/status`: Update candidate stage (`NEW` -> `UNDER_REVIEW` -> ...).
- `GET /applications/:id/resume`: Authenticated PDF stream of applicant resume.
- `POST /applications/:id/interviews`: Schedule Google Meet interview.
- `PATCH /applications/:id/interviews/:interviewId`: Reschedule or cancel interview.
- `POST /applications/:id/notes`: Add confidential staff evaluation note.
- `POST /applications/:id/send-email`: Send custom email to applicant.
