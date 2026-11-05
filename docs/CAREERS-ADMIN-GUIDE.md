# ASRA Academy — Careers & Recruitment Admin Guide

| Field       | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| Module      | Careers & Recruitment Management System                     |
| Audience    | System Administrators, HR Managers, Academic Directors      |
| Target URL  | `/admin/recruitment`                                        |
| Access Role | `ADMIN`, `SUPER_ADMIN` with `recruitment.manage` permission |

---

## 1. Overview & Navigation

The **Recruitment Management System** provides administrators and hiring managers with a unified workspace to publish faculty and staff positions, review applicant submissions, conduct evaluations, schedule interviews, and track the entire hiring pipeline.

### Accessing the Portal

1. Sign in to the ASRA Admin Dashboard using an authorized administrator account (`ADMIN` or `SUPER_ADMIN`).
2. In the left-hand navigation sidebar, locate the **Careers & Recruitment** section:
   - **Overview (`/admin/recruitment`)**: Live pipeline statistics, recent vacancies, and quick actions.
   - **Job Postings (`/admin/recruitment/jobs`)**: Complete listing and lifecycle management of all vacancies.
   - **Post New Job (`/admin/recruitment/jobs/new`)**: Job creation wizard and dynamic question builder.
   - **Applications (`/admin/recruitment/applications`)**: Centralized applicant tracking system (ATS) table.

---

## 2. Recruitment Dashboard & Analytics

The overview page (`/admin/recruitment`) renders real-time database-backed metrics to monitor hiring health:

- **Pipeline Metric Cards (KPIs):**
  - **Total Jobs**: Cumulative count of all created positions.
  - **Published Jobs**: Vacancies currently open and accepting submissions on the public site.
  - **Draft Jobs**: Vacancies currently being authored.
  - **Total Applications**: Total candidates received across all postings.
  - **Under Review**: Applications actively assigned for evaluation.
  - **Interviews Scheduled**: Candidates with active Google Meet or in-person sessions.
  - **Accepted**: Candidates selected for appointment.
- **Departmental Breakdown:** Visual breakdown of applications categorized by department (Academic, Administration, Technology, etc.).
- **Recent Submissions Table:** Immediate access to the latest candidates with one-click navigation to their profiles.

---

## 3. Job Posting Lifecycle

### 3.1 Creating a New Job (`/admin/recruitment/jobs/new`)

The job creation form is structured into four intuitive sections:

#### Section 1: Basic Information

- **Job Title**: Clear, descriptive title (e.g., _Senior Chemistry Faculty (Classes 11–12)_).
- **Department**: Target division (Academic, Administration, Technology, Student Support, etc.).
- **Job Category**: Functional discipline (Teaching Faculty, Academic Coordination, Software Engineering, etc.).
- **Employment Type**: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `VISITING_FACULTY`, or `INTERNSHIP`.
- **Work Arrangement**: `ON_SITE`, `REMOTE`, or `HYBRID`.
- **Location**: Specific campus or city (e.g., _Patna, Bihar_).
- **Vacancies**: Number of available openings (defaults to 1).
- **Experience Required**: Minimum relevant experience in years.
- **Qualifications**: Minimum educational qualification required (e.g., _M.Sc Chemistry, B.Ed_).
- **Compensation**: Optional minimum and maximum salary figures with currency (`INR`). Check **Public Salary Visibility** to display this range on the public job page; unchecking keeps salary strictly confidential.

#### Section 2: Job Description & Requirements

- **Short Description**: Brief overview summary shown on search cards.
- **Full Job Description**: Comprehensive position summary.
- **Key Responsibilities**: Bullet points of day-to-day responsibilities.
- **Required Skills**: Must-have competencies and subject knowledge.
- **Preferred Skills**: Nice-to-have capabilities.
- **Benefits & Perks**: Institutional perks (PF, health coverage, academic allowances).

#### Section 3: Publication Settings

- **Publication Status**:
  - `DRAFT`: Saved privately for team review; invisible to the public.
  - `PUBLISHED`: Made immediately visible on `/careers` if opening date is met.
- **Application Opening Date**: Timestamp when applications open.
- **Application Deadline**: Date and time when the job automatically stops accepting new submissions.
- **Allow Applications Toggle**: Master switch to pause submissions immediately.

#### Section 4: Dynamic Screening Questions

Admins can build custom questions tailored to the position:

1. Click **+ Add Screening Question**.
2. Enter the **Question Label** (e.g., _Do you have experience teaching CBSE Class 12 Chemistry?_).
3. Optional **Help Text** to guide the applicant.
4. Select **Question Type**:
   - `SHORT_TEXT`: Single-line response.
   - `LONG_TEXT`: Multi-line detailed explanation.
   - `SINGLE_SELECT`: Dropdown choice (enter comma-separated options).
   - `MULTI_SELECT`: Checkbox list for multiple selections.
   - `YES_NO`: Direct boolean choice.
   - `NUMBER`: Numeric input with min/max bounds.
   - `DATE`: Date picker.
   - `URL`: Web link (e.g., portfolio or publication).
5. Toggle **Required** if the question is mandatory.
6. Set **Display Order** to sequence questions cleanly.

_Note: Changes made to questions after candidates apply will not alter past responses. Past submissions retain a historical snapshot._

### 3.2 Editing, Unpublishing & Archiving

- **Edit**: Updates job details and question definitions. The original Job ID (`ASRA-JOB-YYYY-XXXXX`) remains permanent.
- **Unpublish**: Instantly hides the position from the public portal without deleting historical candidate data.
- **Archive / Delete**: Soft-deletes the job. Only jobs with zero active applications can be deleted permanently.

---

## 4. Candidate Evaluation & Management

### 4.1 Application Management (`/admin/recruitment/applications`)

Filter candidate submissions using:

- **Search**: Matches candidate name, email, phone, or application ID.
- **Job Filter**: View applications specific to a single vacancy.
- **Status Filter**: Filter by `NEW`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `ACCEPTED`, or `REJECTED`.

### 4.2 Candidate Profile & Evaluation (`/admin/recruitment/applications/[id]`)

Clicking any candidate opens the evaluation panel:

1. **Candidate Dossier:**
   - Full Name, Email Address, Contact Number, Current City.
   - Total Experience, Highest Qualification, Notice Period, Current & Expected CTC.
   - Application Reference Number (`ASRA-APP-YYYY-XXXXX`) and submission timestamp.
2. **Resume Review:**
   - Click **View Resume** to stream the applicant's PDF directly in a secure, authenticated browser tab.
   - Resumes are validated for PDF integrity and served securely through private API streams.
3. **Screening Responses:**
   - Displays all responses to the job's dynamic questions alongside the question snapshots.
4. **Confidential Internal Notes:**
   - Add private evaluation notes and feedback visible only to staff with `recruitment.manage`.
   - Notes record author name, timestamp, and evaluation text.
5. **Workflow Stage Updates:**
   - Update candidate status from the dropdown:
     - `NEW` ➔ Candidate applied.
     - `UNDER_REVIEW` ➔ Profile undergoing initial screening.
     - `SHORTLISTED` ➔ Candidate cleared initial review.
     - `INTERVIEW_SCHEDULED` ➔ Interview arranged.
     - `ACCEPTED` ➔ Selected for offer.
     - `REJECTED` ➔ Application declined.
   - Each transition is permanently audited in the status history timeline.

---

## 5. Scheduling Interviews

When a candidate is moved to the interview stage, admins can schedule a meeting directly from the candidate detail view:

1. Scroll to the **Interviews** card and click **Schedule Interview**.
2. Configure session parameters:
   - **Interview Title**: e.g., _Round 1: Academic Subject Evaluation_.
   - **Interview Format**: `ONLINE`, `IN_PERSON`, or `TELEPHONIC`.
   - **Date & Time**: Scheduled date and local time.
   - **Duration**: Duration in minutes (e.g., 45 minutes).
   - **Google Meet Link**: Valid Google Meet URL (`https://meet.google.com/xxx-yyyy-zzz`).
   - **Interviewer(s)**: Names and roles of the interview panel.
   - **Candidate Instructions**: Notes on preparation, presentation requirements, or test lessons.
3. Click **Confirm & Send Invitation**.
4. **Automated Notification:** The system automatically dispatches an **Interview Invitation Email** to the candidate containing the scheduled date, time, Google Meet link, and instructions.
5. **Rescheduling / Cancellation:**
   - To reschedule: Click **Reschedule**, select the new time, and optionally enter a reason. A reschedule notification is automatically sent.
   - To cancel: Click **Cancel Interview** and provide a reason. A cancellation email is dispatched.

---

## 6. Applicant Email Communication

Administrators can send ad-hoc, customized communications to candidates at any point:

1. In the candidate view, click **Send Email**.
2. Select an email template or write a custom subject and body.
3. Review the message and click **Send**.
4. The message is dispatched via Resend and permanently logged under the **Communications History** panel on the candidate page.

---

## 7. Audit Logging & Compliance

All sensitive recruitment actions are auditable:

- Application status changes are stored in `job_application_status_history` with the acting administrator's ID.
- Outbound emails are stored in `job_application_communications` with delivery timestamps and error logs.
- Candidate notes record the author's identity and cannot be deleted by unauthorized users.
- Public applicant endpoints are rate-limited to prevent automated harvesting or spam submissions.
