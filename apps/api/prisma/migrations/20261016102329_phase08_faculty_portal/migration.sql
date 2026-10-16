-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "live_class_status" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "max_marks" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assignment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_url" VARCHAR(2048),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "submission_status" NOT NULL DEFAULT 'SUBMITTED',
    "marks_awarded" INTEGER,
    "feedback" TEXT,
    "graded_by_id" UUID,
    "graded_at" TIMESTAMPTZ(3),
    "result_released_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_class_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "host_faculty_profile_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "live_class_status" NOT NULL DEFAULT 'SCHEDULED',
    "provider" VARCHAR(50),
    "join_url" VARCHAR(2048),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "live_class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_lesson_id_key" ON "assignments"("lesson_id");

-- CreateIndex
CREATE INDEX "assignments_created_by_id_idx" ON "assignments"("created_by_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_assignment_id_status_idx" ON "assignment_submissions"("assignment_id", "status");

-- CreateIndex
CREATE INDEX "assignment_submissions_user_id_result_released_at_idx" ON "assignment_submissions"("user_id", "result_released_at");

-- CreateIndex
CREATE INDEX "assignment_submissions_graded_by_id_idx" ON "assignment_submissions"("graded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignment_id_user_id_key" ON "assignment_submissions"("assignment_id", "user_id");

-- CreateIndex
CREATE INDEX "live_class_sessions_course_id_starts_at_idx" ON "live_class_sessions"("course_id", "starts_at");

-- CreateIndex
CREATE INDEX "live_class_sessions_host_faculty_profile_id_starts_at_idx" ON "live_class_sessions"("host_faculty_profile_id", "starts_at");

-- CreateIndex
CREATE INDEX "live_class_sessions_created_by_id_idx" ON "live_class_sessions"("created_by_id");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_host_faculty_profile_id_fkey" FOREIGN KEY ("host_faculty_profile_id") REFERENCES "faculty_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PHASE 08 CHECK constraints (hand-written: Prisma schema cannot express them).
-- Documented in docs/DATABASE.md §Constraints and docs/FACULTY-PORTAL.md.
-- =============================================================================

-- Whole marks out of 1–1000 (I-03 assumption: numeric marks).
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_max_marks_range"
    CHECK ("max_marks" BETWEEN 1 AND 1000);

-- Marks are never negative (the upper bound, max_marks, is checked by the service).
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_marks_non_negative"
    CHECK ("marks_awarded" IS NULL OR "marks_awarded" >= 0);

-- GRADED ⇔ marks and grading time are recorded.
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_consistent"
    CHECK (("status" = 'GRADED') = ("marks_awarded" IS NOT NULL AND "graded_at" IS NOT NULL));

-- Only a graded submission can have a released result.
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_release_requires_grade"
    CHECK ("result_released_at" IS NULL OR "status" = 'GRADED');

-- Student work is never empty, and links are https only (validated further by the API).
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_body_not_blank"
    CHECK (length(btrim("body")) > 0);
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_attachment_https"
    CHECK ("attachment_url" IS NULL OR "attachment_url" LIKE 'https://%');

-- Live classes: sensible length; a cancelled class records when; links are https and say where
-- they came from.
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_duration_range"
    CHECK ("duration_minutes" BETWEEN 15 AND 480);
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_cancelled_at_consistent"
    CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_join_url_https"
    CHECK ("join_url" IS NULL OR ("join_url" LIKE 'https://%' AND "provider" IS NOT NULL));
