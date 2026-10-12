Absolutely. Since you are handling **manager + architect + developer + tester + deployment**, you should **not start development directly from the client's visual/order document**.

The client's document is a good **business-level Project Development Order**, but it is not yet a developer-ready specification. It defines the broad objective, education programs, portals, pages, and technical expectations, but leaves many implementation decisions open. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

So I would convert it into a proper **ASRA Academy Technical PRD + SRS + System Architecture + Module Specification**.

And as requested, **Section 7 — Commercial Proposal is completely ignored.**

---

# ASRA ACADEMY
## Technical Product Requirements & System Specification

**Project:** ASRA Academy — Online Learning Platform & LMS  
**Client:** ASRA Academy  
**Development Partner:** Marvel's Techworks  
**Document Type:** Technical PRD + SRS + Architecture Specification  
**Version:** v1.0  
**Status:** Development Baseline  
**Primary Objective:** Production-ready, scalable, responsive LMS

---

# 1. Product Vision

ASRA Academy will be developed as a **modern, modular online learning ecosystem** rather than a simple educational website.

The platform will combine:

- School education — Classes 6–12
- CBSE-oriented curriculum
- Live classes
- Recorded lectures
- Study materials
- Assignments
- Quizzes
- Mock tests/examinations
- Progress tracking
- Faculty management
- Special courses
- Admissions/enrolments
- Online payments
- Notifications
- Certificates
- Administrative management

The client specifically expects the platform to support future expansion of **courses, languages, faculty and students**, so the architecture must not hard-code today's course structure. ASRA_Academy_Project_Developmen…

---

# 2. Design Direction

The uploaded design reference should be treated as the **UI/UX visual baseline**.

### Brand Direction

**Primary**

- Deep/Dark Green
- Emerald Green
- ASRA Gold

**Supporting**

- Warm White
- Ivory
- Light Green
- Soft Gold
- Charcoal/Dark text

### Design Language

The website should follow:

> **Modern + Minimal + Modular + Premium + Educational + Trustworthy**

The reference specifically demonstrates:

- Card-based UI
- Modular sections
- Rounded cards
- Green/Gold branding
- Large visual hero
- Clean typography
- Spacious layouts
- Icon-based feature cards
- Course cards
- Responsive mobile layouts
- Minimal navigation
- Strong CTA buttons
- Subtle animations
- Rich but non-cluttered UI

### Important

We should **not treat the supplied image as a page-by-page pixel-copy requirement**.

Instead:

> **Design system → reusable components → responsive layouts → page compositions**

This will make the entire product consistent.

---

# 3. Product Architecture

I recommend building ASRA as a **modular monolithic LMS initially**, rather than microservices.

### Why?

At the beginning:

```text
Frontend
    ↓
API / Application Layer
    ↓
Business Modules
    ↓
PostgreSQL
```

is easier to:

- develop
- test
- deploy
- debug
- maintain
- scale vertically

Later, high-load components such as:

- Video processing
- Notifications
- Payments
- Live classes
- Analytics

can be extracted into independent services if required.

---

# 4. Recommended Technology Stack

## Updated ASRA Academy Technology Stack

### 1. Frontend

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
React Hook Form
Zod
TanStack Query
```

**Responsibilities:**
- Public website
- Student portal
- Faculty portal
- Admin dashboard
- Responsive UI/UX
- SEO
- Client-side interactions
- API consumption

---

### 2. Backend

```text
Node.js
Express.js
TypeScript
```

Recommended supporting packages:

```text
Prisma ORM
Zod
JWT
bcrypt
Helmet
CORS
express-rate-limit
```

**Responsibilities:**
- REST APIs
- Authentication
- RBAC
- Business logic
- Course/LMS management
- Enrolments
- Payments
- Assignments
- Quizzes
- Exams
- Progress tracking
- Certificates
- Notifications
- Admin operations

---

### 3. Database

```text
PostgreSQL
```

### Deployment

```text
Neon PostgreSQL
```

Neon will be the initial managed PostgreSQL provider.

Architecture:

```text
Next.js
   ↓
Express.js API
   ↓
Prisma
   ↓
PostgreSQL
   ↓
Neon
```

---

### 4. ORM

```text
Prisma
```

Prisma will handle:

- Database schema
- Migrations
- Queries
- Relations
- Type-safe database access

---

### 5. Authentication & Authorization

```text
JWT
bcrypt
RBAC
```

Roles:

```text
GUEST
STUDENT
FACULTY
ADMIN
SUPER_ADMIN
```

---

### 6. State / API Management

Frontend:

```text
TanStack Query
```

Backend:

```text
REST API
```

Structure:

```text
Next.js
    ↓
TanStack Query
    ↓
Express REST API
    ↓
Prisma
    ↓
Neon PostgreSQL
```

---

### 7. File / Media Storage

Keep this provider-independent initially.

```text
Object Storage
```

Possible implementation:

```text
Cloudinary
```

or

```text
AWS S3 / S3-compatible storage
```

For:

- Course thumbnails
- Faculty photos
- Student avatars
- PDFs
- Notes
- Assignment files
- Certificates
- Video assets

---

### 8. Live Classes

Provider-independent integration:

```text
LiveClass Service
        ↓
┌───────┼────────┐
│       │        │
Zoom   Meet    Jitsi
```

The database stores the provider and meeting information rather than hardcoding one provider.

---

### 9. Payment

Create a provider abstraction:

```text
Payment Service
      ↓
Payment Gateway
```

So the application doesn't become tightly coupled to one gateway.

---

### 10. Notifications

```text
Notification Service
       ├── Email
       ├── WhatsApp
       └── In-App
```

Provider can be configured later.

---

### 11. Background Jobs

Since we're using Express rather than NestJS:

```text
Redis
+
BullMQ
```

for background tasks such as:

- Email notifications
- WhatsApp notifications
- Certificate generation
- Scheduled reminders
- Video processing
- Heavy report generation

---

### 12. Validation

Shared validation approach:

```text
Zod
```

Frontend:

```text
React Hook Form + Zod
```

Backend:

```text
Express + Zod
```

---

### 13. API Documentation

```text
OpenAPI / Swagger
```

The Express backend should expose proper API documentation during development.

---

### 14. Testing

Frontend:

```text
Vitest
React Testing Library
Playwright
```

Backend:

```text
Vitest / Jest
Supertest
```

E2E:

```text
Playwright
```

---

### 15. Code Quality

```text
TypeScript
ESLint
Prettier
Husky
lint-staged
```

---

### 16. Monitoring

```text
Sentry
```

for:

- Frontend errors
- Backend exceptions
- API failures
- Production debugging

---

# Final Locked Stack

```text
┌───────────────────────────────────────────┐
│              ASRA ACADEMY                 │
├───────────────────────────────────────────┤
│ Frontend                                  │
│ Next.js + TypeScript                      │
│ Tailwind + shadcn/ui + Framer Motion      │
├───────────────────────────────────────────┤
│ API                                       │
│ Node.js + Express.js + TypeScript         │
├───────────────────────────────────────────┤
│ ORM                                       │
│ Prisma                                    │
├───────────────────────────────────────────┤
│ Database                                  │
│ PostgreSQL                                │
│ ↓                                         │
│ Neon                                      │
├───────────────────────────────────────────┤
│ Authentication                            │
│ JWT + bcrypt + RBAC                       │
├───────────────────────────────────────────┤
│ Validation                                │
│ Zod                                       │
├───────────────────────────────────────────┤
│ API State                                 │
│ TanStack Query                            │
├───────────────────────────────────────────┤
│ Background Jobs                           │
│ Redis + BullMQ                            │
├───────────────────────────────────────────┤
│ Storage                                   │
│ Cloudinary / S3-compatible                │
├───────────────────────────────────────────┤
│ Payments                                  │
│ Payment Gateway Adapter                   │
├───────────────────────────────────────────┤
│ Live Classes                              │
│ Provider Adapter                          │
├───────────────────────────────────────────┤
│ Notifications                             │
│ Email + WhatsApp + In-App                 │
├───────────────────────────────────────────┤
│ Testing                                   │
│ Vitest/Jest + RTL + Supertest + Playwright│
├───────────────────────────────────────────┤
│ Monitoring                                │
│ Sentry                                    │
└───────────────────────────────────────────┘
```

### Core Architecture

```text
                  ┌─────────────────┐
                  │     Next.js     │
                  │   TypeScript    │
                  └────────┬────────┘
                           │
                      REST / JSON
                           │
                  ┌────────▼────────┐
                  │   Express.js    │
                  │    Node.js      │
                  │   TypeScript    │
                  └────────┬────────┘
                           │
                       Prisma ORM
                           │
                  ┌────────▼────────┐
                  │   PostgreSQL    │
                  │      Neon       │
                  └─────────────────┘

        ┌────────────────────────────────┐
        │ External Services              │
        ├────────────────────────────────┤
        │ Redis / BullMQ                  │
        │ Cloudinary / S3                 │
        │ Payment Gateway                 │
        │ Live Class Provider             │
        │ Email Provider                  │
        │ WhatsApp Provider               │
        │ Sentry                          │
        └────────────────────────────────┘
```

So yes: **the previously defined technical PRD remains valid; replace the NestJS backend section with Node.js + Express + TypeScript, and PostgreSQL deployment with Neon.** Everything else stays as specified.

---

# 7. High-Level Architecture

```text
                         ASRA ACADEMY
                              │
             ┌────────────────┴────────────────┐
             │                                 │
          Public Web                       Student App
             │                                 │
             └────────────────┬────────────────┘
                              │
                         API Gateway
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 Auth/RBAC          Application
                    │                   │
        ┌───────────┼───────────────────┼────────────┐
        │           │                   │            │
     Courses      LMS               Payments      Users
        │           │                   │            │
     Faculty     Classes          Enrolments     Profiles
        │           │                   │            │
     Content     Exams             Orders        Admin
        │           │                   │            │
        └───────────┴───────────────────┴────────────┘
                              │
                     PostgreSQL Database
                              │
                ┌─────────────┼─────────────┐
                │             │             │
             Redis         Object        External
                          Storage         Services
```

---

# 8. User Roles

The system should implement **RBAC — Role Based Access Control**.

## 8.1 Guest

Can:

- View homepage
- View courses
- View faculty
- Read blogs
- View course details
- Submit enquiry
- Contact academy
- Start registration

Cannot:

- Access paid content
- Access student dashboard
- Submit assignments

---

# 8.2 Student

Can:

- Register
- Login
- Browse courses
- Enrol
- Pay
- Attend live classes
- Watch recordings
- Download materials
- Attempt quizzes
- Submit assignments
- Attempt exams
- View results
- Track progress
- View certificates
- Manage profile
- View payment history

---

# 8.3 Faculty

Can:

- Login
- Manage assigned courses
- Upload lectures
- Upload study material
- Create assignments
- Create quizzes
- Schedule classes
- Review submissions
- Review student performance
- Publish announcements

The client specifically requires faculty to upload recorded lectures, notes and assignments and review student submissions/results. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

---

# 8.4 Admin

Admin has complete control over:

- Students
- Faculty
- Courses
- Subjects
- Classes
- Enrolments
- Payments
- Live classes
- Content
- Assignments
- Exams
- Results
- Certificates
- Notifications
- Coupons/offers
- Reports
- Settings

This matches the requested Admin Dashboard scope. ASRA_Academy_Project_Developmen…

---

# 8.5 Super Admin

Optional higher-level role.

Can additionally:

- Manage administrators
- Change system configuration
- Manage permissions
- Access audit logs
- Configure integrations
- Manage platform-level settings

---

# 9. Core Product Modules

The application should be divided into these modules.

```text
01 Authentication
02 User Management
03 Student Management
04 Faculty Management
05 Academic Structure
06 Course Management
07 Content Management
08 Live Classes
09 Assignments
10 Quiz Engine
11 Examination Engine
12 Progress Tracking
13 Enrolment
14 Payment
15 Certificate
16 Notification
17 Communication
18 Blog / CMS
19 Search
20 Offers / Coupons
21 Reports & Analytics
22 Admin Dashboard
23 Security & Audit
24 System Configuration
```

---

# 10. Academic Structure

This is one of the most important architectural decisions.

Do **not** create separate hardcoded tables such as:

```text
class6_courses
class7_courses
class8_courses
...
```

Instead:

```text
AcademicLevel
      ↓
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

Example:

```text
Class 10
   ↓
CBSE
   ↓
Science
   ↓
Mathematics
   ↓
Chapter 1
   ↓
Real Numbers
   ↓
Lesson 1
```

This allows ASRA to expand later.

---

# 11. Course Architecture

Every course should contain:

```text
Course
 ├── Basic Information
 ├── Thumbnail
 ├── Description
 ├── Instructor
 ├── Category
 ├── Class
 ├── Subject
 ├── Price
 ├── Discount
 ├── Duration
 ├── Course Status
 ├── Curriculum
 │     ├── Module
 │     │     ├── Chapter
 │     │     │     ├── Lesson
 │     │     │     ├── Video
 │     │     │     ├── Notes
 │     │     │     └── Assignment
 ├── Quiz
 ├── Exam
 └── Certificate
```

---

# 12. Course Categories

Initial categories from client requirement:

### Academic

- Class 6–8
- Class 9–10
- Class 11–12

### Languages

- English
- Hindi
- Urdu
- Arabic

### Special

- Quranic Studies
- Entrepreneurship & Business

The client's order explicitly identifies English, Entrepreneurship & Business, Quranic Studies, Arabic and Urdu as special-course areas. ASRA_Academy_Project_Developmen…

---

# 13. Content Management System

Admin/Faculty should be able to create:

### Video

```text
Title
Description
Thumbnail
Video
Duration
Order
Free/Paid
Preview
```

### PDF

```text
Title
Description
File
Download permission
Visibility
```

### Lesson

```text
Title
Video
Notes
Resources
Quiz
Assignment
```

---

# 14. Student Learning Flow

The core student journey:

```text
Visit Website
      ↓
Browse Course
      ↓
Course Details
      ↓
Register / Login
      ↓
Enrol
      ↓
Payment (if required)
      ↓
Course Activated
      ↓
Student Dashboard
      ↓
Course
      ↓
Module
      ↓
Lesson
      ↓
Video / Material
      ↓
Quiz / Assignment
      ↓
Progress Updated
      ↓
Final Examination
      ↓
Certificate
```

---

# 15. Student Dashboard

The dashboard should be highly modular.

### Dashboard widgets

```text
Welcome Student
────────────────────────

Continue Learning
[Course Card]

My Courses
[Course] [Course] [Course]

Today's Classes
[Live Class Card]

Upcoming
[Schedule]

Progress
████████░░ 80%

Assignments
Pending: 3

Upcoming Exams
2

Recent Results

Certificates
```

---

# 16. Course Player

The course-learning screen should have:

```text
┌─────────────────────────────────────┐
│ Course Header                       │
├──────────────┬──────────────────────┤
│ Curriculum   │                      │
│              │   Video Player       │
│ Module 1     │                      │
│  ✓ Lesson 1  │                      │
│  ✓ Lesson 2  │                      │
│  ● Lesson 3  │                      │
│    Lesson 4  │                      │
│              │                      │
│ Module 2     │                      │
├──────────────┴──────────────────────┤
│ Notes | Resources | Assignment      │
└─────────────────────────────────────┘
```

Responsive mobile version:

```text
Video
↓
Lesson
↓
Progress
↓
Resources
↓
Assignment
↓
Next Lesson
```

---

# 17. Progress Tracking

Track at minimum:

```text
Course Progress
Lesson Completion
Video Completion
Quiz Score
Assignment Status
Exam Score
Overall Performance
Last Activity
Time Spent
```

Example:

```text
Mathematics
Progress: 72%

Lessons:
18 / 25 completed

Quiz:
82%

Assignments:
7 / 8

Exam:
78%
```

The client explicitly requires progress tracking, examination results and enrolment/payment history. ASRA_Academy_Project_Developmen…

---

# 18. Live Classes Module

Live classes should not be tightly coupled to a particular provider.

Create:

```text
LiveClass
```

with:

```text
title
course
faculty
start_time
end_time
meeting_provider
meeting_url
recording_url
status
```

Possible providers:

- Zoom
- Google Meet
- Jitsi
- Microsoft Teams
- Future custom provider

The client requires integration with a suitable live-class solution. ASRA_Academy_Project_Developmen…

---

# 19. Assignment Module

Faculty:

```text
Create Assignment
       ↓
Attach Course/Lesson
       ↓
Set Deadline
       ↓
Publish
```

Student:

```text
View Assignment
      ↓
Download Questions
      ↓
Upload Answer
      ↓
Submit
```

Faculty:

```text
Review
 ↓
Marks
 ↓
Feedback
 ↓
Publish Result
```

---

# 20. Quiz Engine

Support:

- MCQ
- Multiple correct answers
- True/False
- Short answer

Future:

- Fill in blanks
- Match the following

Quiz configuration:

```text
Question count
Time limit
Attempts
Passing score
Negative marking
Randomization
Instant result
```

---

# 21. Examination Engine

The examination system should be independent from quizzes.

### Exam

```text
Exam
 ├── Instructions
 ├── Questions
 ├── Duration
 ├── Start Time
 ├── End Time
 ├── Attempts
 ├── Marks
 ├── Negative Marking
 ├── Passing Percentage
 └── Result
```

---

# 22. Certificate Module

After completing required conditions:

```text
Course Completion
       ↓
Eligibility Check
       ↓
Certificate Generated
       ↓
Unique Certificate ID
       ↓
Student Download
```

Certificate verification page:

```text
/asraacademy.in/verify/CERT-2026-XXXX
```

---

# 23. Admission & Enrolment

The client explicitly requires an Admission and Enrolment page. ASRA_Academy_Project_Developmen…

Flow:

```text
Course
 ↓
Enrol Now
 ↓
Login/Register
 ↓
Student Details
 ↓
Course Selection
 ↓
Payment
 ↓
Order Created
 ↓
Enrolment Activated
 ↓
Confirmation
```

---

# 24. Payment Architecture

Payment should be abstracted behind a payment service.

```text
PaymentService
      │
      ├── Gateway
      ├── Create Order
      ├── Verify Payment
      ├── Webhook
      └── Refund
```

Never activate paid enrolment solely from frontend payment success.

Correct flow:

```text
Frontend
 ↓
Create Payment Order
 ↓
Gateway
 ↓
Payment
 ↓
Gateway Webhook
 ↓
Backend Verification
 ↓
Payment = SUCCESS
 ↓
Enrolment = ACTIVE
```

The client requires secure payment gateway integration if paid courses are enabled. ASRA_Academy_Project_Developmen…

---

# 25. Notification System

Central notification module.

Channels:

```text
In-App
Email
WhatsApp
```

Events:

- Registration
- Login alert
- Course enrolment
- Payment success
- Payment failure
- Live class reminder
- Assignment deadline
- Exam reminder
- Result published
- Certificate generated
- Admin announcement

The client's requirement explicitly includes WhatsApp enquiry integration and email notifications. ASRA_Academy_Project_Developmen…

---

# 26. WhatsApp Integration

Website should provide:

```text
WhatsApp CTA
```

Possible locations:

- Header
- Hero
- Contact
- Course page
- Admission
- Floating button

Later:

```text
WhatsApp Business API
```

can support transactional notifications.

---

# 27. Public Website

Required pages from the client:

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
 /login
 /contact
 /privacy-policy
 /terms
 /refund-policy
```

These map directly to the required website pages in the client order. ASRA_Academy_Project_Developmen…

---

# 28. Homepage Architecture

Based on the supplied design reference:

```text
Header
 ↓
Hero
 ↓
Platform Highlights
 ↓
Courses
 ↓
Why ASRA Academy
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

# 29. Homepage Hero

Desktop:

```text
LEFT
Quality Education
For a Brighter
Tomorrow

Description

[Explore Courses]
[Join Now]

RIGHT
Educational visual
```

Mobile:

```text
Heading
Description
CTA
Visual
```

The supplied reference uses the **green + gold visual identity**, Islamic/educational imagery and prominent course CTAs.

---

# 30. Component Design System

We should build reusable components instead of designing every page independently.

### Core components

```text
Button
Input
Select
Modal
Drawer
Toast
Badge
Card
CourseCard
FacultyCard
BlogCard
StatCard
FeatureCard
ProgressBar
Avatar
Tabs
Accordion
Table
Pagination
Navbar
Footer
Sidebar
Breadcrumb
SearchBox
FilterPanel
VideoPlayer
QuizCard
AssignmentCard
```

---

# 31. Design Tokens

Example:

```css
--asra-green-900
--asra-green-800
--asra-green-700
--asra-green-600
--asra-green-500

--asra-gold-700
--asra-gold-600
--asra-gold-500

--background
--surface
--surface-muted
--text-primary
--text-secondary
--border
```

Spacing:

```text
4
8
12
16
24
32
48
64
80
```

Border radius:

```text
sm
md
lg
xl
2xl
```

---

# 32. Animation System

Animations should be **subtle**, not excessive.

### Use:

- Fade-in
- Slide-up
- Scale
- Hover elevation
- Button interaction
- Card hover
- Progress animation
- Page transition
- Number counter
- Skeleton loading

### Avoid:

- Excessive parallax
- Continuous movement
- Distracting background animation
- Heavy 3D effects
- Long transitions

Target:

```text
150–300ms
```

for most UI interactions.

---

# 33. Responsive Strategy

Breakpoints:

```text
Mobile
Tablet
Laptop
Desktop
Large Desktop
```

Every module must support:

```text
320px+
768px+
1024px+
1280px+
1440px+
```

The client explicitly requires responsive behavior across mobile phones, tablets and computers. ASRA_Academy_Project_Developmen…

---

# 34. Database Architecture

Core entities:

```text
users
roles
permissions
students
faculty
faculty_subjects

academic_levels
classes
streams
subjects

courses
course_categories
course_instructors

modules
chapters
lessons
lesson_resources

videos
documents

enrollments
payments
orders

live_classes

assignments
assignment_submissions

quizzes
quiz_questions
quiz_options
quiz_attempts

exams
exam_questions
exam_attempts

progress

certificates

notifications

announcements

blogs

coupons
offers

reviews

contact_enquiries

audit_logs
```

---

# 35. Important Database Relationship

The most important relationship:

```text
User
 │
 ├── StudentProfile
 │      │
 │      └── Enrolment
 │              │
 │              └── Course
 │                     │
 │                     └── Module
 │                            │
 │                            └── Lesson
 │
 └── FacultyProfile
          │
          └── CourseAssignment
```

---

# 36. Authentication Architecture

Use:

```text
Access Token
+
Refresh Token
```

Security:

- Password hashing
- Email verification
- Rate limiting
- Login throttling
- Secure cookies where applicable
- Session invalidation
- Password reset
- Role validation
- API authorization

---

# 37. Minor Student Protection

This is particularly important because the platform targets school students.

The client explicitly requires student privacy and appropriate safeguards for minors. ASRA_Academy_Project_Developmen…

Therefore:

### Never expose publicly:

- Student email
- Phone number
- Address
- Private submissions
- Payment information
- Personal performance data

Admin access should be logged.

---

# 38. API Architecture

Example:

```text
/api/v1/auth
/api/v1/users
/api/v1/students
/api/v1/faculty
/api/v1/classes
/api/v1/subjects
/api/v1/courses
/api/v1/modules
/api/v1/lessons
/api/v1/enrollments
/api/v1/payments
/api/v1/live-classes
/api/v1/assignments
/api/v1/quizzes
/api/v1/exams
/api/v1/progress
/api/v1/certificates
/api/v1/notifications
/api/v1/blog
/api/v1/admin
```

---

# 39. API Response Standard

All APIs should follow one format.

### Success

```json
{
  "success": true,
  "message": "Course fetched successfully",
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Course not found",
  "error": {
    "code": "COURSE_NOT_FOUND"
  }
}
```

This makes frontend/backend integration predictable.

---

# 40. Admin Dashboard

Admin dashboard should be a **separate application experience** from the public website.

### Sidebar

```text
Dashboard

Academic
 ├── Classes
 ├── Streams
 ├── Subjects

Courses
 ├── All Courses
 ├── Categories
 ├── Curriculum
 └── Content

Users
 ├── Students
 ├── Faculty
 └── Administrators

Learning
 ├── Live Classes
 ├── Assignments
 ├── Quizzes
 ├── Exams
 └── Certificates

Commerce
 ├── Orders
 ├── Payments
 ├── Coupons
 └── Enrolments

Communication
 ├── Notifications
 ├── Announcements
 └── Enquiries

Content
 ├── Blog
 └── Pages

Analytics
 ├── Students
 ├── Courses
 ├── Revenue
 └── Performance

System
 ├── Settings
 ├── Roles
 ├── Permissions
 └── Audit Logs
```

---

# 41. Admin Dashboard KPIs

Top-level cards:

```text
Total Students
Active Students
Total Faculty
Active Courses
Total Enrolments
Revenue
Pending Assignments
Upcoming Classes
```

Charts:

```text
Student Growth
Enrolment Growth
Revenue
Course Popularity
Student Completion
Exam Performance
```

---

# 42. Search Architecture

Global search should support:

```text
Courses
Subjects
Faculty
Blog
Study Material
```

Example:

```text
Search "Physics"

→ Physics Courses
→ Physics Faculty
→ Physics Lessons
→ Physics Articles
```

---

# 43. SEO

Public pages should support:

```text
SEO title
Meta description
Canonical URL
OpenGraph
Twitter metadata
Structured data
Sitemap
Robots.txt
```

Course pages should be indexable.

Student dashboard should not be indexable.

---

# 44. Performance Requirements

Target:

```text
LCP < 2.5s
CLS < 0.1
INP < 200ms
```

Use:

- Image optimization
- Lazy loading
- Code splitting
- CDN
- Server rendering
- Caching
- Skeleton loaders
- Optimized assets

---

# 45. File & Video Architecture

Do **not** store large videos/PDFs directly in PostgreSQL.

Database:

```text
metadata
URL/key
file size
mime type
duration
```

Object storage:

```text
/videos
/documents
/thumbnails
/certificates
/avatars
```

---

# 46. Video Security

For paid courses:

Avoid simply exposing permanent public URLs.

Preferred:

```text
Student
 ↓
Backend authorization
 ↓
Signed URL
 ↓
Video CDN
```

Signed URLs should expire.

---

# 47. Audit Logging

Important administrative actions:

```text
LOGIN
CREATE
UPDATE
DELETE
PUBLISH
UNPUBLISH
PAYMENT
REFUND
RESULT_UPDATE
COURSE_UPDATE
USER_ROLE_CHANGE
```

Store:

```text
user
action
resource
resource_id
IP
timestamp
metadata
```

---

# 48. Testing Strategy

Since **you are also the tester**, testing needs to be designed into development rather than done at the end.

### Testing layers

```text
Unit Testing
     ↓
Integration Testing
     ↓
API Testing
     ↓
Component Testing
     ↓
E2E Testing
     ↓
Security Testing
     ↓
Performance Testing
     ↓
UAT
     ↓
Production
```

---

# 49. Critical E2E Test

The most important business flow:

```text
Register
 ↓
Login
 ↓
Browse Course
 ↓
Enroll
 ↓
Payment
 ↓
Payment Verification
 ↓
Course Activated
 ↓
Watch Lesson
 ↓
Progress Updated
 ↓
Submit Assignment
 ↓
Faculty Reviews
 ↓
Quiz
 ↓
Exam
 ↓
Result
 ↓
Certificate
```

This entire flow should have an automated E2E test.

---

# 50. Definition of Done

A module is **not complete** merely because the UI exists.

A feature is DONE when:

```text
✓ UI implemented
✓ Responsive
✓ API implemented
✓ Database implemented
✓ Validation implemented
✓ Authorization implemented
✓ Error handling implemented
✓ Loading states implemented
✓ Empty states implemented
✓ Mobile tested
✓ Desktop tested
✓ API tested
✓ Security checked
✓ E2E flow tested
✓ Documentation updated
```

---

# 51. Development Phases

## Phase 0 — Foundation

```text
Project setup
Architecture
Database
Authentication
RBAC
Design system
CI/CD
Environment configuration
```

---

## Phase 1 — Public Website

```text
Home
About
Courses
Faculty
Admission
Contact
Blog
Legal pages
SEO
Responsive UI
```

---

## Phase 2 — Academic CMS

```text
Classes
Streams
Subjects
Courses
Modules
Chapters
Lessons
Faculty
Content
```

---

## Phase 3 — Student LMS

```text
Student registration
Dashboard
Enrolment
Course player
Videos
PDFs
Progress
```

---

## Phase 4 — Faculty Portal

```text
Faculty dashboard
Content upload
Assignments
Classes
Student submissions
Performance
```

---

## Phase 5 — Assessment

```text
Quiz
Assignment
Exam
Results
Progress
Certificate
```

---

## Phase 6 — Commerce

```text
Payment
Orders
Enrolments
Coupons
Invoices/receipts
Payment history
```

---

## Phase 7 — Communication

```text
Email
WhatsApp
Notifications
Announcements
Reminders
```

---

## Phase 8 — Analytics

```text
Student analytics
Course analytics
Faculty analytics
Revenue analytics
Exam analytics
```

---

## Phase 9 — Production Hardening

```text
Security audit
Performance
SEO
Backup
Monitoring
Error tracking
Load testing
E2E testing
UAT
Deployment
```

---

# 52. MVP Definition

I strongly recommend **not building every possible LMS feature in V1**.

### V1 MUST HAVE

```text
✓ Public Website
✓ Authentication
✓ Student Portal
✓ Faculty Portal
✓ Admin Dashboard
✓ Course Management
✓ Academic Structure
✓ Video Lessons
✓ PDF Materials
✓ Enrolment
✓ Payment
✓ Live Classes
✓ Assignments
✓ Quizzes
✓ Progress
✓ Results
✓ Notifications
✓ Responsive UI
✓ SEO
✓ Security
```

### V1.1

```text
Certificate
Advanced analytics
Coupons
Reviews
Blog CMS improvements
WhatsApp automation
```

### V2

```text
Mobile App
Advanced examination engine
AI learning assistant
Recommendation engine
Advanced analytics
Gamification
Leaderboard
Offline learning
```

---

# 53. What Should NOT Be Hardcoded

This is extremely important for future scalability.

Don't hardcode:

```text
Classes
Subjects
Courses
Faculty
Pricing
Course categories
Languages
Exam rules
Certificate templates
Payment gateway
Live-class provider
Notification provider
```

These should come from:

```text
Database
+
Admin Configuration
+
Environment Variables
```

---

# 54. Environment Configuration

Example:

```env
DATABASE_URL=

REDIS_URL=

JWT_SECRET=

STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET=

PAYMENT_PROVIDER=
PAYMENT_KEY=
PAYMENT_SECRET=

EMAIL_PROVIDER=
EMAIL_API_KEY=

WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=

LIVE_CLASS_PROVIDER=
LIVE_CLASS_API_KEY=

NEXT_PUBLIC_APP_URL=
API_URL=
```

No secrets inside Git.

---

# 55. Folder Architecture

### Frontend

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── course/
│   ├── faculty/
│   ├── dashboard/
│   └── admin/
├── features/
│   ├── auth/
│   ├── courses/
│   ├── enrollment/
│   ├── learning/
│   ├── assignments/
│   ├── exams/
│   └── payments/
├── hooks/
├── lib/
├── services/
├── types/
└── utils/
```

### Backend

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── students/
│   ├── faculty/
│   ├── academic/
│   ├── courses/
│   ├── content/
│   ├── live-classes/
│   ├── assignments/
│   ├── quizzes/
│   ├── exams/
│   ├── progress/
│   ├── enrollments/
│   ├── payments/
│   ├── certificates/
│   ├── notifications/
│   ├── blog/
│   └── admin/
├── common/
├── config/
├── database/
└── main.ts
```

---

# 56. API Security

Every protected API should follow:

```text
Request
 ↓
Authentication
 ↓
Role Authorization
 ↓
Resource Authorization
 ↓
Validation
 ↓
Business Logic
 ↓
Database
```

Example:

A faculty member shouldn't merely have:

```text
role = FACULTY
```

and therefore be allowed to modify every course.

Instead:

```text
FACULTY
 ↓
Is faculty assigned to this course?
 ↓
YES → Allow
NO → Forbidden
```

---

# 57. Important Business Rules

### Enrollment

```text
Course must be ACTIVE
Student must be authenticated
Payment must be successful for paid course
Duplicate active enrollment prohibited
```

### Content

```text
Only authorized faculty/admin can upload
Only published content is visible to students
```

### Assignment

```text
Submission after deadline → configurable
Multiple attempts → configurable
Faculty can grade only assigned course
```

### Exam

```text
Exam availability must be checked server-side
Timer must not depend solely on browser
Submission must be persisted
```

---

# 58. Error Handling

Every major module needs:

### Loading state

```text
Skeleton
```

### Empty state

```text
No courses found
No assignments
No upcoming classes
```

### Error state

```text
Something went wrong
[Retry]
```

### Success

```text
Toast / confirmation
```

---

# 59. Accessibility

Target:

```text
WCAG-oriented implementation
```

At minimum:

- Semantic HTML
- Keyboard navigation
- Focus states
- Accessible forms
- Alt text
- Contrast
- Screen-reader labels
- Accessible buttons
- Error messages

---

# 60. Documentation Required

Marvel's Techworks should maintain:

```text
README
Architecture Documentation
Environment Setup
Database Schema
API Documentation
Authentication Documentation
Deployment Guide
Admin Guide
Testing Guide
Troubleshooting Guide
```

The client specifically expects source code and deployment documentation as part of the deliverables. ASRA_Academy_Project_Developmen…

---

# 61. Acceptance Criteria

The project should be considered technically acceptable when:

### Public Website

- All required public pages work.
- Responsive on mobile/tablet/desktop.
- Design follows ASRA green/gold visual system.
- Navigation works.
- Forms validate correctly.
- SEO metadata is implemented.

### Student

- Registration works.
- Login works.
- Courses can be browsed.
- Enrolment works.
- Payment verification works.
- Course content is accessible according to authorization.
- Progress is persisted.
- Assignments work.
- Quizzes work.
- Results are visible.

### Faculty

- Faculty can access assigned courses.
- Faculty can upload content.
- Faculty can create assignments.
- Faculty can review submissions.
- Faculty can manage classes.

### Admin

- Admin can manage users.
- Admin can manage academic structure.
- Admin can manage courses.
- Admin can manage content.
- Admin can manage payments/enrolments.
- Admin can manage live classes.
- Admin can manage notifications.
- Reports work.

### Security

- Unauthorized API access blocked.
- Role escalation blocked.
- Student private data protected.
- Payment verified server-side.
- Admin actions logged.

---

# 62. Client Requirement → Technical Translation

This is the part that is **most important for you as Manager/Developer**.

| Client says | We translate it into |
|---|---|
| "Online learning platform" | LMS architecture |
| "Class 6–12" | Academic hierarchy |
| "Special courses" | Dynamic course categories |
| "Live classes" | LiveClass module + provider adapter |
| "Recorded lectures" | Video/content module |
| "Notes/PDF" | Resource management |
| "Assignments" | Assignment engine |
| "Mock tests" | Assessment engine |
| "Examinations" | Examination module |
| "Progress tracking" | Progress service |
| "Payment" | Payment service + webhook |
| "Faculty portal" | Faculty RBAC |
| "Admin dashboard" | Admin CMS |
| "Certificates" | Certificate service |
| "Notifications" | Notification service |
| "WhatsApp" | Communication integration |
| "SEO friendly" | SSR + metadata + sitemap |
| "Scalable" | Dynamic DB-driven architecture |
| "Secure for minors" | Privacy + RBAC + audit |
| "Mobile responsive" | Responsive design system |

This is exactly the transformation we need from the client's broad requirements into engineering requirements.

---

# 63. Critical Decisions Still Required From Client

Before development starts, **do not guess these**.

Create a Client Clarification Sheet.

### Academic

1. Exact classes?
2. Exact subjects?
3. Which Class 11–12 streams?
4. Course-wise faculty?
5. Course duration?

### Content

6. Who uploads videos?
7. Where will videos be hosted?
8. Maximum video size?
9. Who creates quizzes?
10. Who creates exams?

### Live Classes

11. Zoom / Meet / Jitsi / other?
12. Will recordings be automatically available?

### Payments

13. Which payment gateway?
14. Which currencies?
15. Refund policy?
16. GST/invoice requirements?

### Student

17. Is parent/guardian information required?
18. Is parental consent required for minors?
19. Is phone OTP required?
20. Email verification?

### Certificates

21. Which courses issue certificates?
22. What are eligibility conditions?
23. Certificate design?

### Communication

24. Which WhatsApp provider?
25. Which email provider?

### Content

26. Who owns copyright?
27. Can students download videos?
28. Can students download PDFs?

### Admin

29. How many admin roles?
30. Who can publish courses?
31. Who can modify payments/results?

---

# 64. Recommended Final Architecture

If I were leading this project at Marvel's Techworks, I would lock the architecture approximately like this:

```text
                    ASRA ACADEMY
                         │
             ┌───────────┴───────────┐
             │                       │
        Public Website          LMS Application
             │                       │
             └───────────┬───────────┘
                         │
                    Next.js
                         │
                    REST API
                         │
                    NestJS
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   PostgreSQL          Redis          Object Storage
        │                │                │
        │           Background Jobs       │
        │                                 │
        └──────────────┬──────────────────┘
                       │
             External Integrations
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Payment        Live Class      Email
        │              │              │
        └──────────────┼──────────────┘
                       │
                    WhatsApp
```

---

# 65. The Development Philosophy

For this project, the rule should be:

> **"Build the platform, not just the pages."**

The homepage in the supplied design is only the **visual entry point**.

The actual product is:

```text
ASRA Website
      +
Authentication
      +
Academic CMS
      +
LMS
      +
Student Portal
      +
Faculty Portal
      +
Admin Panel
      +
Assessment Engine
      +
Payment System
      +
Communication
      +
Analytics
      +
Security
```

The client's current document already establishes that this is a **Website + LMS**, with separate Student, Faculty and Admin capabilities, rather than merely a marketing website. ASRA_Academy_Project_Developmen… ASRA_Academy_Project_Developmen…

---

## What I would do next

Don't start coding from this yet.

The proper next engineering artifact should be:

### **ASRA Academy — Technical PRD v1.0**

followed by:

1. **Complete SRS**
2. **System Architecture Document**
3. **Database ERD**
4. **Module-wise feature breakdown**
5. **User journeys / workflows**
6. **API specification**
7. **RBAC permission matrix**
8. **Frontend route architecture**
9. **Admin dashboard information architecture**
10. **UI component/design system specification**
11. **Testing strategy + test cases**
12. **Development milestone/task breakdown**
13. **Client clarification sheet**
14. **Final Definition of Done**

That will give you a **proper engineering blueprint** that you can hand to another developer and say: *"Build ASRA according to this specification"*—without relying on the client's verbal explanation or the single visual reference.