-- PHASE 16 — Careers & Recruitment System (docs/CAREERS-RECRUITMENT.md)
-- Adds job postings, application questions, job applications, answers, status history, notes, interviews, and candidate communications.

-- CreateEnum
CREATE TYPE "job_application_status" AS ENUM (
    'RECEIVED',
    'UNDER_REVIEW',
    'SHORTLISTED',
    'ON_HOLD',
    'INTERVIEW_SCHEDULED',
    'ACCEPTED',
    'REJECTED'
);

-- CreateEnum
CREATE TYPE "job_question_type" AS ENUM (
    'SHORT_TEXT',
    'LONG_TEXT',
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'YES_NO',
    'NUMBER',
    'DATE',
    'URL'
);

-- CreateEnum
CREATE TYPE "interview_status" AS ENUM (
    'SCHEDULED',
    'RESCHEDULED',
    'COMPLETED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "recruitment_email_status" AS ENUM (
    'SENT',
    'FAILED',
    'PENDING'
);

-- CreateTable
CREATE TABLE "job_sequences" (
    "year" INTEGER NOT NULL,
    "current_val" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "application_sequences" (
    "year" INTEGER NOT NULL,
    "current_val" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "employment_type" VARCHAR(50) NOT NULL DEFAULT 'Full-time',
    "work_location" VARCHAR(100) NOT NULL,
    "work_arrangement" VARCHAR(50) NOT NULL DEFAULT 'On-site',
    "vacancies" INTEGER,
    "experience_required" VARCHAR(100),
    "min_qualification" VARCHAR(150),
    "max_qualification" VARCHAR(150),
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "is_salary_public" BOOLEAN NOT NULL DEFAULT false,
    "short_description" VARCHAR(500),
    "description" TEXT NOT NULL,
    "responsibilities" TEXT,
    "required_skills" TEXT,
    "preferred_skills" TEXT,
    "required_qualifications" TEXT,
    "additional_requirements" TEXT,
    "benefits" TEXT,
    "status" "publication_status" NOT NULL DEFAULT 'DRAFT',
    "opening_date" TIMESTAMPTZ(3),
    "closing_date" TIMESTAMPTZ(3),
    "allow_applications" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "help_text" VARCHAR(500),
    "field_type" "job_question_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "validation" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_id" VARCHAR(50) NOT NULL,
    "job_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "current_location" VARCHAR(100) NOT NULL,
    "resume_asset_id" VARCHAR(255) NOT NULL,
    "resume_original_name" VARCHAR(255) NOT NULL,
    "resume_mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "resume_file_size" INTEGER NOT NULL,
    "status" "job_application_status" NOT NULL DEFAULT 'RECEIVED',
    "consent_given" BOOLEAN NOT NULL DEFAULT true,
    "consent_given_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "question_id" UUID,
    "question_label" VARCHAR(200) NOT NULL,
    "field_type" VARCHAR(50) NOT NULL,
    "answer_text" TEXT,
    "answer_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "from_status" "job_application_status",
    "to_status" "job_application_status" NOT NULL,
    "reason" VARCHAR(500),
    "changed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 45,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "interview_type" VARCHAR(50) NOT NULL DEFAULT 'Technical Interview',
    "meeting_url" VARCHAR(2048) NOT NULL,
    "instructions" TEXT,
    "notes" TEXT,
    "status" "interview_status" NOT NULL DEFAULT 'SCHEDULED',
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_communications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "recipient_email" VARCHAR(320) NOT NULL,
    "template" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "message_text" TEXT NOT NULL,
    "message_html" TEXT,
    "provider_message_id" VARCHAR(100),
    "status" "recruitment_email_status" NOT NULL DEFAULT 'SENT',
    "error" VARCHAR(500),
    "sent_by_id" UUID,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_communications_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX "jobs_job_id_key" ON "jobs"("job_id");
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");
CREATE UNIQUE INDEX "job_applications_reference_id_key" ON "job_applications"("reference_id");
CREATE UNIQUE INDEX "job_applications_job_id_normalized_email_key" ON "job_applications"("job_id", "normalized_email");

-- Performance Indexes
CREATE INDEX "jobs_status_closing_date_idx" ON "jobs"("status", "closing_date");
CREATE INDEX "jobs_department_idx" ON "jobs"("department");
CREATE INDEX "jobs_category_idx" ON "jobs"("category");
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at");

CREATE INDEX "job_application_questions_job_id_display_order_idx" ON "job_application_questions"("job_id", "display_order");

CREATE INDEX "job_applications_job_id_status_idx" ON "job_applications"("job_id", "status");
CREATE INDEX "job_applications_status_created_at_idx" ON "job_applications"("status", "created_at");
CREATE INDEX "job_applications_created_at_idx" ON "job_applications"("created_at");
CREATE INDEX "job_applications_normalized_email_idx" ON "job_applications"("normalized_email");

CREATE INDEX "job_application_answers_application_id_idx" ON "job_application_answers"("application_id");
CREATE INDEX "job_application_answers_question_id_idx" ON "job_application_answers"("question_id");

CREATE INDEX "job_application_status_history_application_id_created_at_idx" ON "job_application_status_history"("application_id", "created_at");

CREATE INDEX "job_application_notes_application_id_created_at_idx" ON "job_application_notes"("application_id", "created_at");

CREATE INDEX "job_interviews_application_id_scheduled_at_idx" ON "job_interviews"("application_id", "scheduled_at");
CREATE INDEX "job_interviews_status_scheduled_at_idx" ON "job_interviews"("status", "scheduled_at");

CREATE INDEX "job_application_communications_application_id_sent_at_idx" ON "job_application_communications"("application_id", "sent_at");

-- Foreign Keys
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_application_questions" ADD CONSTRAINT "job_application_questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_application_answers" ADD CONSTRAINT "job_application_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_application_answers" ADD CONSTRAINT "job_application_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "job_application_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_application_status_history" ADD CONSTRAINT "job_application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_application_status_history" ADD CONSTRAINT "job_application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_application_notes" ADD CONSTRAINT "job_application_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_application_notes" ADD CONSTRAINT "job_application_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_interviews" ADD CONSTRAINT "job_interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_interviews" ADD CONSTRAINT "job_interviews_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_application_communications" ADD CONSTRAINT "job_application_communications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_application_communications" ADD CONSTRAINT "job_application_communications_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity CHECK constraints
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_check" CHECK ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_max" >= "salary_min");
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_dates_check" CHECK ("opening_date" IS NULL OR "closing_date" IS NULL OR "closing_date" > "opening_date");
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_id_format" CHECK ("job_id" ~ '^ASRA-JOB-[0-9]{4}-[0-9]{5}$');
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_email_normalized" CHECK ("normalized_email" = LOWER(TRIM("normalized_email")));
