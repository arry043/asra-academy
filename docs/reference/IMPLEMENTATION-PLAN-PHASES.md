# ASRA Academy — Phase-by-Phase Implementation Plan

Perfect. Now that the **technology stack is locked**, we can convert the PRD into an actual **engineering execution plan**.

The objective is to build ASRA Academy in a controlled sequence where each phase produces something testable and doesn't create unnecessary rework later.

The client's document defines this as a **Website + LMS**, with Student, Faculty and Admin capabilities, live/recorded learning, study material, assessments, progress tracking, enrolment/payment, notifications and scalability. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

> **Important:** We are intentionally excluding the client's Section 7 — Commercial Proposal.

---

# 0. Overall Development Roadmap

```text
PHASE 00 — Requirement Freeze & Project Setup
        ↓
PHASE 01 — Project Foundation & Architecture
        ↓
PHASE 02 — Database & Backend Core
        ↓
PHASE 03 — Authentication + RBAC
        ↓
PHASE 04 — Design System + Frontend Foundation
        ↓
PHASE 05 — Public Website
        ↓
PHASE 06 — Academic & Course Management
        ↓
PHASE 07 — Student LMS
        ↓
PHASE 08 — Faculty Portal
        ↓
PHASE 09 — Assessment System
        ↓
PHASE 10 — Enrolment + Payments
        ↓
PHASE 11 — Live Classes + Notifications
        ↓
PHASE 12 — Admin Dashboard + Analytics
        ↓
PHASE 13 — Security + Performance + SEO
        ↓
PHASE 14 — Complete QA / UAT
        ↓
PHASE 15 — Production Deployment
        ↓
PHASE 16 — Post-Launch Stabilization
```

---

# PHASE 00 — Requirement Freeze & Project Preparation

### Objective

Before writing production code, convert the client's verbal requirements and design reference into a **development baseline**.

The client document itself states that the final subject list depends on class, stream and faculty availability, so these details should be confirmed before the academic structure is finalized. ASRA_Academy_Project_Developmen…

### Tasks

- Finalize PRD
- Finalize SRS
- Finalize feature list
- Finalize user roles
- Finalize academic hierarchy
- Finalize course structure
- Finalize payment requirement
- Finalize live-class provider
- Finalize storage provider
- Finalize notification providers
- Finalize exact public pages
- Identify client-provided assets
- Identify content dependencies
- Create requirements clarification sheet

### Deliverables

```text
/docs
├── PRD.md
├── SRS.md
├── ARCHITECTURE.md
├── REQUIREMENTS.md
├── CLIENT-CLARIFICATIONS.md
└── CHANGELOG.md
```

### Exit Criteria

> No major feature should remain ambiguous before Phase 02 begins.

---

# PHASE 01 — Project Foundation & Architecture

### Objective

Create the actual development environment.

### Repository

I recommend a monorepo:

```text
asra-academy/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── config/
│
├── docs/
│
├── .gitignore
├── README.md
└── package.json
```

### Frontend

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
```

### Backend

```text
Node.js
Express
TypeScript
```

### Database

```text
PostgreSQL
Neon
Prisma
```

### Setup

- Git repository
- Branch strategy
- Environment management
- ESLint
- Prettier
- Husky
- lint-staged
- TypeScript configuration
- CI pipeline
- Development scripts

### Environment

```env
DATABASE_URL=
DIRECT_DATABASE_URL=

JWT_SECRET=

NEXT_PUBLIC_API_URL=

STORAGE_URL=
STORAGE_KEY=
STORAGE_SECRET=

PAYMENT_KEY=
PAYMENT_SECRET=

EMAIL_API_KEY=

WHATSAPP_API_KEY=

REDIS_URL=
```

### Exit Criteria

```text
Frontend → runs
Backend → runs
Database → connects
Prisma → works
Lint → passes
TypeScript → passes
Git → configured
CI → passes
```

---

# PHASE 02 — Database & Backend Core

This is where the **real LMS foundation** starts.

### Objective

Build the backend architecture before implementing business features.

---

## 2.1 Express Architecture

```text
api/src/
│
├── config/
├── database/
├── middleware/
├── routes/
├── controllers/
├── services/
├── repositories/
├── validators/
├── utils/
├── types/
└── app.ts
```

Recommended request flow:

```text
Request
 ↓
Router
 ↓
Middleware
 ↓
Controller
 ↓
Service
 ↓
Repository / Prisma
 ↓
Database
```

---

## 2.2 Database Foundation

Initial models:

```text
User
Role
Permission

StudentProfile
FacultyProfile

AcademicLevel
Class
Stream
Subject

Course
CourseCategory
CourseInstructor

Module
Chapter
Lesson
Resource
```

Then establish relationships and indexes.

### Exit Criteria

- Prisma schema complete
- Initial migration successful
- Neon connected
- Seed system working
- Database reset/seed process documented

---

# PHASE 03 — Authentication & RBAC

### Objective

Build security before building protected portals.

### Authentication

```text
Register
Login
Logout
Refresh Session
Forgot Password
Reset Password
Email Verification
```

### RBAC

```text
SUPER_ADMIN
ADMIN
FACULTY
STUDENT
```

### Authorization

Example:

```text
Student
   ↓
Can access own courses

Faculty
   ↓
Can access assigned courses

Admin
   ↓
Can manage platform

Super Admin
   ↓
Can manage administrators/system
```

### Security

- Password hashing
- JWT
- Refresh tokens
- Rate limiting
- Helmet
- CORS
- Request validation
- Authentication middleware
- Authorization middleware

### Exit Criteria

You should be able to test:

```text
Student Login        ✓
Faculty Login        ✓
Admin Login          ✓
Unauthorized API     → 401
Wrong Role           → 403
Invalid Token        → 401
```

---

# PHASE 04 — Design System & Frontend Foundation

This phase is particularly important because the supplied reference strongly establishes the **ASRA visual language**.

The reference should become a **design system**, not a collection of individually copied screens.

### Brand System

```text
ASRA Green
ASRA Gold
Warm White
Ivory
Dark Text
Muted Green
```

### Typography

Define:

```text
Display
Heading
Body
Caption
Label
```

### Components

Build reusable:

```text
Button
Input
Select
Card
Badge
Modal
Drawer
Tabs
Accordion
Table
Pagination
Toast
Tooltip
Avatar
Progress
Skeleton
```

### ASRA Components

```text
CourseCard
FacultyCard
FeatureCard
CourseCategoryCard
TestimonialCard
LiveClassCard
AssignmentCard
ExamCard
ProgressCard
```

### Layout

```text
Navbar
Footer
Container
Section
Sidebar
DashboardLayout
AdminLayout
```

### Animation

Use:

```text
Fade
Slide
Scale
Hover
Reveal
Progress
Page transition
```

but keep them subtle.

### Exit Criteria

Every core component should work on:

```text
Mobile
Tablet
Desktop
Large Desktop
```

---

# PHASE 05 — Public Website

Now build the marketing/educational website.

The client specifically lists Home, About, Classes 6–10, Classes 11–12, special courses, Faculty, Admission, Login, Contact and legal pages. ASRA_Academy_Project_Developmen…

---

## Homepage

```text
Navbar
↓
Hero
↓
Platform Highlights
↓
Courses
↓
Why ASRA
↓
Live Classes
↓
Faculty
↓
Learning Process
↓
Testimonials
↓
CTA
↓
Footer
```

---

## Public Pages

```text
/
 /about
 /courses
 /classes/6-10
 /classes/11-12
 /courses/english
 /courses/entrepreneurship
 /courses/quranic-studies
 /courses/arabic
 /courses/urdu
 /faculty
 /admission
 /contact
 /blog
 /privacy-policy
 /terms
 /refund-policy
```

### Features

- Responsive navigation
- Course browsing
- Course filtering
- Search
- Faculty profiles
- Contact form
- WhatsApp CTA
- Admission CTA
- SEO metadata
- Sitemap
- Robots.txt

### Exit Criteria

Public website is completely usable **without authentication**.

---

# PHASE 06 — Academic & Course Management

This is the beginning of the actual LMS CMS.

### Academic hierarchy

```text
Class
 ↓
Stream
 ↓
Subject
 ↓
Course
 ↓
Module
 ↓
Chapter
 ↓
Lesson
```

### Admin capabilities

Admin can:

```text
Create Class
Create Stream
Create Subject
Create Category
Create Course
Assign Faculty
Create Module
Create Chapter
Create Lesson
Publish Course
Unpublish Course
```

---

## Course Management

Course fields:

```text
Title
Slug
Description
Thumbnail
Category
Class
Subject
Faculty
Duration
Price
Discount
Status
Visibility
```

---

## Content

```text
Video
PDF
Document
External Resource
Quiz
Assignment
```

### Exit Criteria

An admin can create:

```text
Class 10
 ↓
Mathematics
 ↓
Course
 ↓
Module
 ↓
Chapter
 ↓
Lesson
 ↓
Video/PDF
```

and publish it.

---

# PHASE 07 — Student LMS

Now we build the actual **student learning experience**.

The client requires registration/login, dashboard, live/recorded classes, study material, quizzes, assignments, examinations, progress and enrolment/payment history. ASRA_Academy_Project_Developmen…

---

## Student Dashboard

```text
Dashboard
├── Continue Learning
├── My Courses
├── Upcoming Classes
├── Assignments
├── Exams
├── Progress
├── Results
└── Certificates
```

---

## Course Player

```text
Course
 ↓
Module
 ↓
Chapter
 ↓
Lesson
 ↓
Video
 ↓
Resources
 ↓
Quiz/Assignment
```

### Progress

Track:

```text
Lesson completion
Video completion
Quiz attempts
Assignment completion
Course progress
Last activity
```

---

## Student Profile

```text
Personal Information
Academic Information
Enrolled Courses
Payment History
Learning History
Certificates
```

### Exit Criteria

A student can:

```text
Register
 ↓
Login
 ↓
Access course
 ↓
Watch lesson
 ↓
Download material
 ↓
Complete lesson
 ↓
Progress updates
```

---

# PHASE 08 — Faculty Portal

The client requires faculty profiles, subject allocation, content upload, live-class scheduling, submission/result review and student performance monitoring. ASRA_Academy_Project_Developmen…

### Faculty Dashboard

```text
Dashboard
├── Assigned Courses
├── Students
├── Live Classes
├── Content
├── Assignments
├── Submissions
├── Quizzes
├── Exams
└── Performance
```

---

## Faculty Content Management

Faculty can:

```text
Create Lesson
Upload Video
Upload PDF
Add Resources
Create Assignment
Create Quiz
```

---

## Submission Management

```text
Assignment
 ↓
Student Submission
 ↓
Faculty Review
 ↓
Marks
 ↓
Feedback
 ↓
Result
```

### Exit Criteria

Faculty can independently manage learning content for courses they're authorized to manage.

---

# PHASE 09 — Assessment Engine

This phase contains three related but separate systems.

```text
Quiz
Assignment
Examination
```

---

# 9.1 Quiz

Support:

- MCQ
- True/False
- Multiple answers

Configuration:

```text
Time limit
Attempts
Passing score
Negative marking
Random questions
Instant result
```

---

# 9.2 Assignment

```text
Create
 ↓
Publish
 ↓
Student Submission
 ↓
Faculty Review
 ↓
Marks
 ↓
Feedback
```

---

# 9.3 Examination

```text
Exam
 ↓
Instructions
 ↓
Questions
 ↓
Timer
 ↓
Submission
 ↓
Evaluation
 ↓
Result
```

### Important

Exam timing and submission must be **server-controlled**, not dependent solely on browser JavaScript.

### Exit Criteria

Complete assessment lifecycle works:

```text
Faculty creates exam
 ↓
Student attempts
 ↓
Submission stored
 ↓
Evaluation
 ↓
Result
 ↓
Student sees result
```

---

# PHASE 10 — Enrolment & Payment

The client's requirement includes course enrolment/payment history and secure payment integration where paid courses are enabled. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

### Enrolment

```text
Course
 ↓
Enroll
 ↓
Login/Register
 ↓
Checkout
 ↓
Payment
 ↓
Verification
 ↓
Enrolment ACTIVE
```

### Database

```text
Order
Payment
Enrollment
```

These should be separate entities.

---

## Payment Flow

```text
Frontend
 ↓
Create Order
 ↓
Payment Gateway
 ↓
Payment
 ↓
Webhook
 ↓
Backend Verification
 ↓
Payment SUCCESS
 ↓
Enrollment ACTIVE
```

### Never:

```text
Frontend says "payment successful"
        ↓
Immediately activate course
```

---

## Payment History

Student:

```text
Order ID
Course
Amount
Status
Date
Receipt
```

Admin:

```text
Orders
Payments
Failed Payments
Refunds
Revenue
```

### Exit Criteria

Test:

```text
Successful payment
Failed payment
Cancelled payment
Duplicate webhook
Invalid webhook
Already enrolled
```

---

# PHASE 11 — Live Classes & Notification System

The client explicitly requires live-class integration plus WhatsApp enquiry and email notifications. ASRA_Academy_Project_Developmen…

---

## Live Classes

```text
Create Class
 ↓
Assign Course
 ↓
Assign Faculty
 ↓
Schedule
 ↓
Student Notification
 ↓
Join
 ↓
Recording
```

Support a provider adapter:

```text
LiveClassService
      ↓
Provider
```

This keeps the architecture flexible.

---

## Notification System

Events:

```text
Registration
Enrollment
Payment
Live Class
Assignment
Exam
Result
Certificate
Announcement
```

Channels:

```text
In-App
Email
WhatsApp
```

---

# PHASE 12 — Admin Dashboard & Analytics

Now bring all modules together into the management layer.

### Dashboard

```text
Students
Faculty
Courses
Enrollments
Revenue
Live Classes
Assignments
Exams
```

### Analytics

```text
Student Growth
Course Enrollments
Popular Courses
Revenue
Completion Rate
Exam Performance
Faculty Performance
```

---

## Admin Modules

```text
Dashboard

Users
 ├── Students
 ├── Faculty
 └── Admins

Academic
 ├── Classes
 ├── Streams
 ├── Subjects

Courses
 ├── Courses
 ├── Categories
 ├── Curriculum
 └── Content

Learning
 ├── Live Classes
 ├── Assignments
 ├── Quizzes
 ├── Exams
 └── Certificates

Commerce
 ├── Orders
 ├── Payments
 ├── Enrolments
 └── Coupons

Communication
 ├── Notifications
 ├── Announcements
 └── Enquiries

Content
 └── Blog

Analytics

Settings
 ├── Roles
 ├── Permissions
 └── Audit Logs
```

---

# PHASE 13 — Certificate System

Build this after the assessment/progress system because certificate eligibility depends on those systems.

### Flow

```text
Course Completion
 ↓
Eligibility Check
 ↓
Certificate Generated
 ↓
Certificate ID
 ↓
Student Download
```

### Verification

```text
/verify/:certificateId
```

Certificate should contain:

```text
Student Name
Course
Completion Date
Certificate ID
Academy
Authorized Signature
```

---

# PHASE 14 — SEO, Security & Performance Hardening

This should be treated as a separate engineering phase, not something casually done at the end.

The client explicitly asks for search-engine-friendly structure, privacy/security safeguards and scalable architecture. ASRA_Academy_Project_Developmen…

---

## SEO

```text
Metadata
OpenGraph
Canonical URLs
Sitemap
Robots
Structured Data
Course SEO
Faculty SEO
Blog SEO
```

---

## Security

Test:

```text
Authentication
Authorization
RBAC
IDOR
Rate Limiting
XSS
CSRF considerations
SQL Injection
File Upload
JWT Security
Webhook Security
Admin Security
```

---

## Performance

Optimize:

```text
Images
Fonts
JavaScript
API calls
Database queries
Indexes
Caching
CDN
```

Target:

```text
Fast initial load
Low CLS
Fast interaction
Mobile performance
```

---

# PHASE 15 — Complete QA

Because you're acting as **manager + developer + tester**, this phase needs a formal checklist.

## Testing Pyramid

```text
                E2E
                 ▲
                / \
           Integration
              /   \
          Unit Tests
```

---

## Test Areas

### Functional

```text
Auth
Courses
Enrolment
Payments
Learning
Assignments
Quizzes
Exams
Results
Certificates
Notifications
Admin
Faculty
```

### UI

```text
Mobile
Tablet
Desktop
Different browsers
```

### Security

```text
Unauthorized access
Role escalation
API manipulation
File upload
Payment tampering
```

### Performance

```text
Homepage
Course listing
Course player
Dashboard
API
Database
```

---

# PHASE 16 — UAT / Client Acceptance

Now the system moves from:

> **Developer complete**

to:

> **Client accepted**

---

## UAT Flow

Give ASRA Academy test access.

They test:

```text
Public Website
Student Account
Faculty Account
Admin Account
Course
Enrollment
Payment
Live Class
Assignment
Quiz
Exam
Results
```

Collect:

```text
Bug
Change Request
Content Correction
Design Feedback
```

---

## Categorization

### P0 — Critical

System unusable.

### P1 — High

Core functionality broken.

### P2 — Medium

Feature issue.

### P3 — Minor

UI/cosmetic issue.

---

# PHASE 17 — Production Deployment

### Production infrastructure

```text
                Internet
                   │
                   ▼
              Cloudflare
                   │
          ┌────────┴────────┐
          │                 │
       Next.js           Express API
          │                 │
          │              Prisma
          │                 │
          └────────┬────────┘
                   │
                Neon DB
```

External:

```text
Storage
Payment
Email
WhatsApp
Live Classes
Sentry
```

---

## Production Checklist

```text
✓ Production environment variables
✓ Database migration
✓ Database backup
✓ Domain
✓ SSL
✓ CORS
✓ Security headers
✓ Rate limiting
✓ Error monitoring
✓ Logging
✓ Storage
✓ Payment webhooks
✓ Email
✓ WhatsApp
✓ Sitemap
✓ Robots
✓ SEO
✓ Analytics
```

---

# PHASE 18 — Post-Launch Stabilization

After launch:

```text
Monitor
 ↓
Collect Errors
 ↓
Fix Critical Bugs
 ↓
Analyze Usage
 ↓
Optimize
 ↓
Release Patch
```

Recommended:

```text
v1.0.0 → Initial Production
v1.0.1 → Critical fixes
v1.0.2 → Minor fixes
v1.1.0 → Improvements
v1.2.0 → New features
```

---

# Recommended Development Order

There is one important adjustment I would make to the chronological list above.

**Don't build entire phases in isolation.** Build vertical slices after the foundation.

Your actual development execution should look like:

```text
                    FOUNDATION
                        │
        ┌───────────────┼────────────────┐
        ↓               ↓                ↓
     Frontend        Backend          Database
        │               │                │
        └───────────────┼────────────────┘
                        ↓
                   AUTH + RBAC
                        ↓
             ┌──────────┴──────────┐
             ↓                     ↓
        Public Website       Admin Foundation
             │                     │
             └──────────┬──────────┘
                        ↓
                Academic/Courses
                        ↓
                 Student LMS
                        ↓
                 Faculty Portal
                        ↓
                  Assessments
                        ↓
              Enrolment + Payment
                        ↓
           Live Classes + Notifications
                        ↓
                  Certificates
                        ↓
                  Analytics
                        ↓
              Security + Performance
                        ↓
                      QA
                        ↓
                      UAT
                        ↓
                   PRODUCTION
```

---

# Milestone Structure

I would divide the entire project into **8 major milestones** for management purposes.

| Milestone | Includes |
|---|---|
| **M1 — Foundation** | Setup, architecture, DB, Prisma, Express, Next.js |
| **M2 — Identity** | Auth, users, RBAC, profiles |
| **M3 — Website** | Design system + public website |
| **M4 — LMS Core** | Academic structure, courses, content |
| **M5 — Learning** | Student + Faculty portals |
| **M6 — Assessment & Commerce** | Quiz, exams, assignments, enrolment, payments |
| **M7 — Platform Services** | Live classes, notifications, certificates, analytics |
| **M8 — Release** | Security, SEO, performance, QA, UAT, deployment |

---

# Git Branch Strategy

Since you're effectively managing the whole engineering lifecycle, keep Git disciplined.

```text
main
│
├── develop
│
├── feature/auth
├── feature/course-management
├── feature/student-dashboard
├── feature/faculty-dashboard
├── feature/assessment
├── feature/payment
├── feature/notifications
└── feature/admin-dashboard
```

Flow:

```text
feature/*
      ↓
develop
      ↓
QA
      ↓
main
      ↓
production
```

---

# Definition of Done for Every Phase

Don't mark a phase complete just because the code "works."

Every phase should satisfy:

```text
┌─────────────────────────────┐
│       PHASE COMPLETE        │
├─────────────────────────────┤
│ ✓ Feature implemented       │
│ ✓ Backend implemented       │
│ ✓ Database implemented      │
│ ✓ Validation               │
│ ✓ Authorization            │
│ ✓ Error handling           │
│ ✓ Loading state             │
│ ✓ Empty state               │
│ ✓ Responsive UI             │
│ ✓ Unit tests                │
│ ✓ API tests                 │
│ ✓ Integration tested        │
│ ✓ Documentation             │
│ ✓ Git merged                │
└─────────────────────────────┘
```

---

# The Most Important Rule for This Project

Don't follow this:

```text
❌ Build all frontend
       ↓
❌ Build backend
       ↓
❌ Connect everything
       ↓
❌ Discover problems
```

Instead:

```text
✅ Database
      ↓
✅ API
      ↓
✅ Frontend
      ↓
✅ Integration
      ↓
✅ Test
      ↓
✅ Complete
```

For example:

### Course Management

```text
DB Course Model
      ↓
Course API
      ↓
Admin Course UI
      ↓
Course Listing UI
      ↓
Course Details
      ↓
Test
      ↓
DONE
```

Then move to the next feature.

This dramatically reduces integration surprises.

---

# Final Project Execution Map

```text
                    ASRA ACADEMY
                         │
              ┌──────────▼──────────┐
              │   FOUNDATION        │
              │ Next + Express      │
              │ PostgreSQL + Neon   │
              │ Prisma + TypeScript │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │ AUTH + RBAC         │
              └──────────┬──────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
┌─────────▼─────────┐        ┌──────────▼─────────┐
│ PUBLIC WEBSITE    │        │ ADMIN FOUNDATION   │
└─────────┬─────────┘        └──────────┬─────────┘
          │                             │
          └──────────────┬──────────────┘
                         │
                ┌────────▼────────┐
                │ ACADEMIC / LMS  │
                │ COURSES         │
                │ CONTENT         │
                └────────┬────────┘
                         │
             ┌───────────┴───────────┐
             │                       │
      ┌──────▼──────┐         ┌──────▼──────┐
      │ STUDENT LMS │         │ FACULTY     │
      │             │         │ PORTAL      │
      └──────┬──────┘         └──────┬──────┘
             │                       │
             └───────────┬───────────┘
                         │
                ┌────────▼────────┐
                │ ASSESSMENTS     │
                │ Quiz/Assignment │
                │ Exams/Results   │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │ COMMERCE        │
                │ Enrolment       │
                │ Payment         │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │ PLATFORM        │
                │ Live Classes    │
                │ Notifications   │
                │ Certificates    │
                │ Analytics       │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │ HARDENING       │
                │ Security        │
                │ SEO             │
                │ Performance     │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │ QA + UAT        │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │ PRODUCTION      │
                └─────────────────┘
```

### One more important management decision

I would make **Phase 00 mandatory before actual feature development**. The client's order explicitly leaves some academic details to later confirmation and describes the document as a proposed order rather than a final binding specification. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

So your first actual engineering milestone should be:

> **Requirements Freeze → Architecture Freeze → Repository Initialization → Database Design → Development begins.**

That gives you a clean baseline as the person responsible for **management, architecture, development, testing, and deployment**.