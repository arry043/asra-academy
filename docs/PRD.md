# ASRA Academy — Product Requirements Document (PRD)

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Project             | ASRA Academy — Online Learning Platform & LMS                                 |
| Client              | ASRA Academy                                                                  |
| Development Partner | Marvel's Techworks                                                            |
| Academy Website     | www.asraacademy.in                                                            |
| Contact Email       | asraacademy1@gmail.com                                                        |
| Tagline             | Learn • Grow • Succeed                                                        |
| Founded by          | Students of AMU                                                               |
| Document Version    | 0.1.0                                                                         |
| Status              | Requirement Freeze — Baseline (pending client clarifications)                 |
| Primary Sources     | Client _Project Development Order_ (§1–6, §8); client visual design reference |

> **Scope note.** Section 7 of the Project Development Order ("Commercial Proposal Requested") is intentionally excluded. This document is an engineering baseline, not a commercial proposal.

> **Labelling convention.** Statements taken from the client's Project Development Order are presented as requirements. Statements added by Marvel's Techworks are explicitly marked **Technical Recommendation**. Open items are tracked in [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md).

---

## 1. Product Vision

> _"ASRA Academy aims to establish a comprehensive digital learning platform combining school education, language development, entrepreneurship, and Quranic Studies in one place. The platform should support long-term growth and expansion of courses, faculty, student enrolments, and geographical reach."_ — Project Development Order, §8

ASRA Academy will be a modern, responsive educational website combined with a Learning Management System (LMS) that serves students across India through school-level coaching, language learning, entrepreneurship education and Quranic Studies.

## 2. Product Objective

Per §1 of the Project Development Order, design, develop, test and deploy a modern online education platform that is:

- **Accessible** — usable on mobile phones, tablets and computers.
- **Affordable** — supports paid courses where enabled, with pricing and promotional offers managed by the academy.
- **User-friendly** — simple, student-friendly interfaces.
- **National in reach** — designed to support students across India.

## 3. Target Users

| User                          | Description                                                                      | Source                     |
| ----------------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| Visitor / Prospective student | Browses the public website, programs, faculty and admission information          | §5 Required Website Pages  |
| Student                       | Registers, logs in, attends classes, studies, takes assessments, tracks progress | §3 Student Portal          |
| Parent / Guardian             | Relevant because many students (Classes 6–12) are minors; exact role **pending** | §4 "safeguards for minors" |
| Faculty                       | Manages subject content, schedules live classes, reviews submissions             | §3 Faculty Portal          |
| Administrator                 | Manages students, teachers, classes, courses, enrolments, pricing, content       | §3 Admin Dashboard         |

Whether parents/guardians receive their own login is **pending client confirmation** (see CLIENT-CLARIFICATIONS §E).

## 4. Product Scope

### 4.1 In scope (per Project Development Order §6 Deliverables)

- Complete website and online learning platform within the agreed scope.
- Admin, student and faculty dashboards.
- Source code and deployment documentation.
- Domain, hosting, security and third-party service configuration.
- Testing and bug fixing before launch.
- Training for academy administrators.
- Written maintenance and post-launch support terms (process; commercial terms excluded).

### 4.2 Out of scope for this document

- Commercial proposal, pricing, taxes, payment milestones, warranty pricing (§7).
- A mobile application. §7 mentions "any mobile application" only in the commercial context; no mobile app requirement is stated in §3–§6. Treated as **Future / Optional** pending confirmation.

## 5. Educational Programs

### 5.1 School Education — Classes 6 to 12

| Band          | Description                                               |
| ------------- | --------------------------------------------------------- |
| Classes 6–10  | CBSE-pattern curriculum                                   |
| Classes 11–12 | Subject-specific coaching for applicable academic streams |

Content model: **chapter-wise lectures, notes, assignments, practice questions and examinations.**

Subjects the client says _may_ be included:

Mathematics · Science · Physics · Chemistry · Biology · English · Hindi · Urdu · Arabic · Social Science · other relevant subjects.

> **PENDING CLIENT CONFIRMATION.** _"The final subject list will be confirmed by ASRA Academy according to class, stream, and faculty availability."_ The platform therefore must **not** hard-code classes, streams or subjects; they are administrator-managed data.

### 5.2 Special Courses

| Course                      | Client-stated content                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| English Language            | Spoken English, grammar, vocabulary, communication skills, writing                             |
| Entrepreneurship & Business | Startup fundamentals, business planning, marketing, finance basics, business management        |
| Quranic Studies             | Quran reading, Tajweed, understanding, structured Islamic studies as determined by the academy |
| Arabic Language             | Reading, writing, grammar, communication                                                       |
| Urdu Language               | Reading, writing, grammar, literature                                                          |

_"Additional academic, professional, and skill-development courses may be added in the future."_ — course catalogue must be extensible.

Course levels, durations, batch structures and pricing for special courses are **pending** (CLIENT-CLARIFICATIONS §B).

## 6. Core Platform Capabilities

### 6.1 Public Website

Required pages (§5):

1. Home
2. About ASRA Academy
3. Classes 6–10
4. Classes 11–12
5. English Language
6. Entrepreneurship & Business
7. Quranic Studies
8. Arabic and Urdu Courses
9. Faculty
10. Admission and Enrolment
11. Student Login
12. Contact Us
13. Privacy Policy
14. Terms and Conditions
15. Refund Policy

Plus: WhatsApp enquiry integration (§4) and search-engine-friendly structure (§4). Page copy, imagery and legal text are client-supplied content (CLIENT-CLARIFICATIONS §T, §X).

### 6.2 Student LMS (Student Portal, §3)

- Student registration and secure login.
- Class/course-wise dashboard.
- Live online classes and recorded lectures.
- Downloadable notes, PDFs and study materials.
- Online quizzes, assignments, mock tests and examinations.
- Progress tracking and examination results.
- Course enrolment and payment history.

### 6.3 Faculty Portal (§3)

- Faculty profiles and subject allocation.
- Upload recorded lectures, notes and assignments.
- Schedule live classes.
- Review student submissions and results.
- Monitor student performance.

### 6.4 Admin Dashboard (§3)

- Manage students, teachers, classes, courses and enrolments.
- Manage course pricing, payment records, live-class schedules and learning content.
- Notifications and announcements.
- Reporting.
- Certificates.
- Promotional offers.

### 6.5 Course System

- Courses belong either to the **School Education** program (class → subject → chapter) or to **Special Courses**.
- Courses can be added over time without code changes.
- Pricing is managed by administrators; free vs. paid is configurable (§4: "if paid courses are enabled").
- **Technical Recommendation:** a generic hierarchy (Program → Category/Class → Course/Subject → Module/Chapter → Lesson) so both school and special courses share one engine.

### 6.6 Learning Content

- Recorded lectures (video).
- Notes, PDFs and study materials (downloadable — download policy per content type is pending, CLIENT-CLARIFICATIONS §H).
- Practice questions.
- Uploaded by faculty; managed by admins.

### 6.7 Live Classes

- Students attend live online classes.
- Faculty schedule live classes; admins manage live-class schedules.
- "Integration with a suitable live-class solution" — provider **pending** (CLIENT-CLARIFICATIONS §F).
- **Technical Recommendation:** provider-independent `LiveClassProvider` abstraction.

### 6.8 Assignments

- Faculty upload assignments; students submit; faculty review submissions.
- Submission format, deadlines and grading rules pending (CLIENT-CLARIFICATIONS §I).

### 6.9 Quizzes

- Online quizzes for students; practice questions per chapter.
- Question types, timing, attempts and auto-grading rules pending (CLIENT-CLARIFICATIONS §J).

### 6.10 Examinations

- Online mock tests and examinations; examination results visible to students.
- Proctoring, scheduling and result-publishing rules pending (CLIENT-CLARIFICATIONS §K).

### 6.11 Progress Tracking

- Students view their progress and results.
- Faculty monitor student performance.
- Admins access reporting.

### 6.12 Enrolment

- Admission and enrolment page on the public website.
- Course enrolment via the student portal; enrolment history visible to students.
- Admins manage enrolments.

### 6.13 Payments

- "Secure payment gateway integration, if paid courses are enabled."
- Students see payment history; admins manage course pricing, payment records and promotional offers.
- Gateway, currency, invoicing/GST and refund workflow pending (CLIENT-CLARIFICATIONS §M, §N). A Refund Policy page is required.

### 6.14 Certificates

- Admin dashboard includes certificates.
- Eligibility, design, verification and which courses issue certificates are pending (CLIENT-CLARIFICATIONS §L).

### 6.15 Notifications

- Email notifications (§4).
- Admin notifications and announcements (§3).
- Channels and events pending (CLIENT-CLARIFICATIONS §O, §Q).

### 6.16 Communication

- WhatsApp enquiry integration (§4).
- Contact Us page.
- Whether WhatsApp is a click-to-chat link or a WhatsApp Business API integration is pending (CLIENT-CLARIFICATIONS §P).

### 6.17 Search

- Not explicitly stated by the client.
- **Technical Recommendation:** course/catalogue search on the public site and within portals, given an extensible course catalogue.

### 6.18 SEO

- "Search-engine-friendly website structure" (§4).
- **Technical Recommendation:** server-rendered public pages, metadata per page, sitemap, robots.txt, structured data, clean URLs.

### 6.19 Security & Privacy

- Secure authentication; student privacy; appropriate safeguards for minors (§4).
- Secure payment handling (§4).
- Backup and maintenance arrangements (§4).
- Privacy Policy and Terms and Conditions pages (§5).

### 6.20 Scalability

- "Scalable architecture to add courses, languages, faculty, and students as the academy grows." (§4)
- Long-term growth in geographical reach (§8).

### 6.21 Responsive Design

- "Responsive design for mobile phones, tablets, and computers." (§4)

### 6.22 Future Extensibility

- Additional academic, professional and skill-development courses (§2B).
- Additional languages (§4) — interpreted as language courses; UI localisation (e.g. Hindi/Urdu/Arabic interface, RTL) is **pending** (CLIENT-CLARIFICATIONS §V).
- Possible mobile application (Future / Optional).

## 7. Design Direction

The client-supplied visual reference is the **visual direction**, not a pixel specification. No exact pixel values, font files or colour codes are assumed beyond what is confirmed by the client.

Design principles:

| Principle                        | Intent                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| Green + Gold ASRA branding       | Deep/emerald green primary, gold accent; exact brand codes pending |
| Modern, clean, minimalistic      | Low visual noise; content first                                    |
| Attractive, educational identity | Imagery and iconography appropriate to an academy                  |
| Modular, card-based              | Reusable rounded cards for courses, faculty, features, stats       |
| Student-friendly                 | Clear language, large tap targets, simple flows                    |
| Strong visual hierarchy          | Clear headings, scannable sections                                 |
| Generous whitespace              | Spacious layouts                                                   |
| Clear CTAs                       | Prominent primary actions (e.g. Explore Courses, Enrol)            |
| Subtle animations                | Short (≈150–300 ms) transitions; no distracting motion             |
| Mobile-first responsive          | Designed for phones first, scaled up to tablet and desktop         |
| Cross-device consistency         | Same component system across mobile, tablet and desktop            |

The design system will be implemented as reusable components (shadcn/ui + Tailwind tokens) in the Design System phase.

### 7.1 Brand Identity (supplied 2026-10-12)

- **Logo:** a crest (crescent and star, gold ring, green "A" with a gold four-point star, open book) above the "ASRA" wordmark in green, "ACADEMY" in gold, and the tagline. Files and usage rules: [brand/README.md](./brand/README.md).
- **Tagline:** _Learn • Grow • Succeed_.
- **Founding statement:** _Founded by students of AMU_.
- **Contact email:** asraacademy1@gmail.com.
- **Colours sampled from the logo:** green `#012114` (highlight `#034729`) and gold `#c88717` (highlight `#e4a735`) on ivory `#fdfbf5`. Official codes still need client confirmation.
- **Still pending:** a vector logo, a light-on-dark logo variant, brand fonts and the homepage design mock-up (CLIENT-CLARIFICATIONS §V).

## 8. Success Criteria (product level)

- All 15 required public pages are live, responsive and SEO-friendly.
- Students can register, log in, enrol, learn (live + recorded + materials), complete assessments and see progress/results/payment history.
- Faculty can manage their allocated subjects' content, live classes and submissions.
- Admins can manage people, academic structure, courses, pricing, payments, schedules, content, notifications, announcements, reports, certificates and offers.
- New classes, subjects, courses and faculty can be added without code changes.

## 9. Related Documents

- [SRS.md](./SRS.md) — detailed software requirements
- [REQUIREMENTS.md](./REQUIREMENTS.md) — requirements matrix
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system architecture
- [CLIENT-CLARIFICATIONS.md](./CLIENT-CLARIFICATIONS.md) — open questions
- [CHANGELOG.md](./CHANGELOG.md) — change history
- [reference/](./reference/) — earlier internal working notes and phase plan (non-authoritative)
