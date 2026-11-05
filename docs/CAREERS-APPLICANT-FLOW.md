# ASRA Academy — Careers Applicant Flow & Experience

| Field      | Value                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| Module     | Careers & Recruitment Management System                                                  |
| Focus Area | Public Candidate Journey, Application Submission, Privacy Guardrails                     |
| Routes     | `/careers`, `/careers/[jobId]`, `/careers/[jobId]/apply`                                 |
| Auth Model | **Guest Only** — Strictly no applicant login, registration, or candidate portal required |

---

## 1. Candidate Journey Overview

The public recruitment experience at ASRA Academy is designed for maximum accessibility, professional branding, and applicant trust. Candidates can explore vacancies, evaluate role requirements, and submit their applications in minutes without being forced to create a user account.

```
┌─────────────────┐       ┌────────────────────┐       ┌───────────────────────┐
│   Browse Jobs   │ ────> │  View Job Details  │ ────> │ Complete Application  │
│    /careers     │       │  /careers/[jobId]  │       │ /careers/[jobId]/apply│
└─────────────────┘       └────────────────────┘       └───────────┬───────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────┐                    ┌───────────────────────┐
│ Email-Driven Candidate Updates  │ <───────────────── │ Submission Confirmed  │
│ - Confirmation Email            │                    │ - ASRA-APP-YYYY-XXXXX │
│ - Interview Invites (Meet)      │                    │ - Clean Success State │
│ - Selection / Rejection Letters │                    └───────────────────────┘
└─────────────────────────────────┘
```

---

## 2. Step-by-Step Experience

### Step 1: Discovering Vacancies (`/careers`)

- **Hero & Mission:** Applicants are greeted with ASRA Academy's educational mission, institutional culture, and why faculty and staff choose to work at ASRA.
- **Dynamic Search & Filters:**
  - **Full-Text Search:** Query by job title, department, or keywords.
  - **Department Filter:** Academic, Administration, Technology, Student Support, Operations, etc.
  - **Category Filter:** Teaching Faculty, Curriculum Development, Software Engineering, etc.
  - **Work Arrangement Filter:** On-Site, Remote, or Hybrid.
  - **Location Filter:** Campus-specific or remote positions.
- **Vacancy Cards:** Display Job Title, Job ID (`ASRA-JOB-YYYY-XXXXX`), Department, Employment Type, Location, Vacancy Count, and Closing Date.
- **Eligibility Enforced:** Only published, active, non-expired positions are presented.

### Step 2: Reviewing Role Requirements (`/careers/[jobId]`)

- Each job features a permanent, canonical URL based on its Job ID (e.g., `/careers/ASRA-JOB-2026-00001`).
- Displays comprehensive details:
  - Role overview, institutional department, and work arrangement.
  - Detailed responsibilities and key milestones.
  - Minimum qualifications and required/preferred technical skills.
  - Public compensation range (if configured as visible by administrators; omitted otherwise).
  - Clear **Apply Now** action button leading directly to the application form.
- If the application deadline has passed or the job is unpublished, the form is disabled automatically with an informative notice.

### Step 3: Completing the Application Form (`/careers/[jobId]/apply`)

The application form is divided into three clear logical sections:

#### 1. Candidate Contact & Professional Profile

- **Full Name**: Applicant's legal name.
- **Email Address**: Valid email used for all subsequent correspondence.
- **Phone Number**: Indian mobile number with automated normalization (accepts `+91 98765 43210`, `09876543210`, or `9876543210` and validates against standard Indian telecom prefixes).
- **Current City / Location**: Candidate's current residing city.
- **Highest Qualification**: Degree or certification attained.
- **Total Experience**: Number of relevant years in the field.
- **Current Organization & Notice Period**: Current employer and availability timeframe in days.
- **Current & Expected CTC**: Financial expectations in INR.
- **Cover Letter / Statement of Purpose**: Personal statement highlighting interest in ASRA Academy.

#### 2. Job-Specific Dynamic Screening Questions

- If the administrator configured custom screening questions for the vacancy, they are dynamically rendered into the form:
  - Structured dropdowns (`SINGLE_SELECT`) and multi-select options (`MULTI_SELECT`).
  - Text fields (`SHORT_TEXT`, `LONG_TEXT`).
  - Numeric inputs with validation limits (`NUMBER`).
  - Date selectors (`DATE`) and web links (`URL`).
  - Boolean questions (`YES_NO`).
- Form validations enforce required fields and input format constraints before submission.

#### 3. Secure PDF Resume Upload

- Drag-and-drop or file selector accepting exclusively `.pdf` documents.
- Strict size enforcement: **Maximum 5 MB**.
- Client and server inspect the file buffer for `%PDF-` magic-byte verification, instantly blocking unauthorized file formats, scripts, or disguised archives.
- Uploaded files generate a tamper-evident HMAC signature token that protects against payload manipulation.

### Step 4: Submission & Reference Confirmation

- Upon clicking **Submit Application**:
  1. The server checks for duplicate active submissions from the same email for the given job.
  2. The server verifies and freezes the dynamic question answers against current question definitions.
  3. The server generates a unique, atomic Application Reference Number: `ASRA-APP-YYYY-XXXXX`.
  4. The applicant is presented with a clear success confirmation displaying their reference number and a notice to check their email.
  5. The transactional email engine delivers an **Application Confirmation Email** containing the reference number, role details, and next steps.

---

## 3. Privacy Safeguards & Security Model

ASRA Academy upholds rigorous privacy standards for all recruitment data:

1. **No Candidate Accounts / Dashboards:**
   - Applicants are never issued login credentials, sessions, or user records in the `users` table.
   - This eliminates account takeover vectors, password reuse risks, and candidate portal vulnerabilities.
2. **Strict Data Isolation:**
   - Applicants cannot view submissions from other applicants.
   - Candidate resumes are stored in private Cloudinary folders or restricted local storage directories (`storage/resumes`).
   - Resumes are never served via public static URLs; they are streamed exclusively through authenticated administrative endpoints with strict RBAC verification.
3. **Auditability & Integrity:**
   - Submissions are immutable once lodged.
   - Dynamic question labels and definitions are snapshotted at submission time, ensuring that future questionnaire edits by administrators do not corrupt past answers.
4. **Rate Limiting & Abuse Prevention:**
   - Public application submission is throttled to 10 requests per 15 minutes per IP address.
   - Resume file uploading is throttled to 60 requests per 15 minutes per IP address.

---

## 4. Email-Driven Applicant Communication

Applicants receive all updates regarding their candidacy via high-priority transactional emails:

- **Application Confirmation:** Dispatched immediately upon form submission.
- **Application Status Updates:** Sent when moving through screening phases.
- **Interview Invitations:** Sent when an interview is scheduled, including the date, time, duration, Google Meet link, and instructions.
- **Interview Reschedules & Cancellations:** Sent with new timings or cancellation reasons.
- **Selection & Rejection Notices:** Professional closing correspondence detailing appointment offers or feedback.
