-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "enrollment_source" AS ENUM ('FREE', 'ADMIN');

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "enrollment_source" NOT NULL,
    "enrolled_by_id" UUID,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "last_lesson_id" UUID,
    "last_activity_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "first_viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "video_position_seconds" INTEGER,
    "video_watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "video_heartbeat_at" TIMESTAMPTZ(3),
    "video_completed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollments_user_id_status_last_activity_at_idx" ON "enrollments"("user_id", "status", "last_activity_at");

-- CreateIndex
CREATE INDEX "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_last_lesson_id_idx" ON "enrollments"("last_lesson_id");

-- CreateIndex
CREATE INDEX "enrollments_enrolled_by_id_idx" ON "enrollments"("enrolled_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_last_viewed_at_idx" ON "lesson_progress"("user_id", "last_viewed_at");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_enrolled_by_id_fkey" FOREIGN KEY ("enrolled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_last_lesson_id_fkey" FOREIGN KEY ("last_lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- PHASE 07 CHECK constraints (hand-written: Prisma schema cannot express them).
-- Documented in docs/DATABASE.md §Constraints and docs/STUDENT-LMS.md.
-- =============================================================================

-- A cancelled enrolment records when; an active one never carries a cancellation time.
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cancelled_at_consistent"
    CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));

-- Administrator enrolments name the administrator when created (SET NULL later if that account
-- is deleted, so the column stays nullable); free self-enrolments never do.
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_free_has_no_enroller"
    CHECK ("source" <> 'FREE' OR "enrolled_by_id" IS NULL);

-- Playback figures are never negative.
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_video_position_non_negative"
    CHECK ("video_position_seconds" IS NULL OR "video_position_seconds" >= 0);
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_video_watched_non_negative"
    CHECK ("video_watched_seconds" >= 0);
