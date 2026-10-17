-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "answer_reveal" AS ENUM ('NEVER', 'AFTER_SUBMISSION', 'AFTER_CLOSE');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "evaluation_status" AS ENUM ('PENDING', 'EVALUATED');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "allow_late_submissions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_resubmission" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "assignment_submissions" ADD COLUMN     "faculty_note" TEXT,
ADD COLUMN     "late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "assignment_submission_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_url" VARCHAR(2048),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,
    "late" BOOLEAN NOT NULL,
    "archived_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submission_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "status" "assessment_status" NOT NULL DEFAULT 'DRAFT',
    "time_limit_minutes" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "pass_percent" INTEGER NOT NULL DEFAULT 40,
    "negative_marking" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "questions_per_attempt" INTEGER,
    "show_result_immediately" BOOLEAN NOT NULL DEFAULT true,
    "answer_reveal" "answer_reveal" NOT NULL DEFAULT 'AFTER_CLOSE',
    "results_published_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examinations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT,
    "status" "assessment_status" NOT NULL DEFAULT 'DRAFT',
    "opens_at" TIMESTAMPTZ(3) NOT NULL,
    "closes_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "pass_percent" INTEGER NOT NULL DEFAULT 40,
    "negative_marking" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "answer_reveal" "answer_reveal" NOT NULL DEFAULT 'NEVER',
    "results_published_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "examinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID,
    "examination_id" UUID,
    "type" "question_type" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "marks" DECIMAL(6,2) NOT NULL,
    "negative_marks" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "assessment_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID,
    "examination_id" UUID,
    "user_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "deadline_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "finalized_at" TIMESTAMPTZ(3),
    "evaluation_status" "evaluation_status",
    "max_score" DECIMAL(8,2) NOT NULL,
    "raw_score" DECIMAL(8,2),
    "penalty" DECIMAL(8,2),
    "score" DECIMAL(8,2),
    "percent" DECIMAL(5,2),
    "passed" BOOLEAN,
    "evaluated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID,
    "position" INTEGER NOT NULL,
    "type" "question_type" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "marks" DECIMAL(6,2) NOT NULL,
    "negative_marks" DECIMAL(6,2) NOT NULL,
    "selected_option_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "text_answer" TEXT,
    "answer_sequence" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMPTZ(3),
    "awarded_marks" DECIMAL(6,2),
    "penalty" DECIMAL(6,2),
    "is_correct" BOOLEAN,
    "feedback" TEXT,
    "graded_by_id" UUID,
    "graded_at" TIMESTAMPTZ(3),

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(60) NOT NULL,
    "actor_id" UUID,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submission_revisions_submission_id_version_key" ON "assignment_submission_revisions"("submission_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_lesson_id_key" ON "quizzes"("lesson_id");

-- CreateIndex
CREATE INDEX "quizzes_status_idx" ON "quizzes"("status");

-- CreateIndex
CREATE INDEX "quizzes_created_by_id_idx" ON "quizzes"("created_by_id");

-- CreateIndex
CREATE INDEX "examinations_course_id_opens_at_idx" ON "examinations"("course_id", "opens_at");

-- CreateIndex
CREATE INDEX "examinations_status_closes_at_idx" ON "examinations"("status", "closes_at");

-- CreateIndex
CREATE INDEX "examinations_created_by_id_idx" ON "examinations"("created_by_id");

-- CreateIndex
CREATE INDEX "assessment_questions_quiz_id_position_idx" ON "assessment_questions"("quiz_id", "position");

-- CreateIndex
CREATE INDEX "assessment_questions_examination_id_position_idx" ON "assessment_questions"("examination_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_question_options_question_id_position_key" ON "assessment_question_options"("question_id", "position");

-- CreateIndex
CREATE INDEX "assessment_attempts_status_deadline_at_idx" ON "assessment_attempts"("status", "deadline_at");

-- CreateIndex
CREATE INDEX "assessment_attempts_user_id_status_idx" ON "assessment_attempts"("user_id", "status");

-- CreateIndex
CREATE INDEX "assessment_attempts_examination_id_status_idx" ON "assessment_attempts"("examination_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_quiz_id_user_id_attempt_number_key" ON "assessment_attempts"("quiz_id", "user_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_examination_id_user_id_attempt_number_key" ON "assessment_attempts"("examination_id", "user_id", "attempt_number");

-- CreateIndex
CREATE INDEX "attempt_questions_question_id_idx" ON "attempt_questions"("question_id");

-- CreateIndex
CREATE INDEX "attempt_questions_graded_by_id_idx" ON "attempt_questions"("graded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attempt_id_position_key" ON "attempt_questions"("attempt_id", "position");

-- CreateIndex
CREATE INDEX "assessment_audit_logs_entity_type_entity_id_created_at_idx" ON "assessment_audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "assessment_audit_logs_actor_id_idx" ON "assessment_audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "assignment_submission_revisions" ADD CONSTRAINT "assignment_submission_revisions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_question_options" ADD CONSTRAINT "assessment_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_audit_logs" ADD CONSTRAINT "assessment_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- PHASE 09 data backfill (additive; no existing row loses information).
-- `late` used to be derived on read (submitted_at > due_at). It is now decided by the server when
-- work is accepted; existing submissions get the value they were already shown with.
-- =============================================================================
UPDATE "assignment_submissions" s
   SET "late" = true
  FROM "assignments" a
 WHERE s."assignment_id" = a."id"
   AND a."due_at" IS NOT NULL
   AND s."submitted_at" > a."due_at";

-- =============================================================================
-- PHASE 09 CHECK constraints (hand-written: Prisma schema cannot express them).
-- Documented in docs/DATABASE.md §Constraints and docs/ASSESSMENTS.md.
-- =============================================================================

-- Assignments: versions start at 1.
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_version_positive"
    CHECK ("version" >= 1);
ALTER TABLE "assignment_submission_revisions" ADD CONSTRAINT "assignment_submission_revisions_version_positive"
    CHECK ("version" >= 1);
ALTER TABLE "assignment_submission_revisions" ADD CONSTRAINT "assignment_submission_revisions_attachment_https"
    CHECK ("attachment_url" IS NULL OR "attachment_url" LIKE 'https://%');

-- Quizzes: bounded rules; publication timestamps follow the status.
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_time_limit_range"
    CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" BETWEEN 1 AND 300);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_max_attempts_range"
    CHECK ("max_attempts" BETWEEN 1 AND 20);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_pass_percent_range"
    CHECK ("pass_percent" BETWEEN 0 AND 100);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_questions_per_attempt_positive"
    CHECK ("questions_per_attempt" IS NULL OR "questions_per_attempt" >= 1);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_published_at_consistent"
    CHECK ("status" = 'DRAFT' OR "published_at" IS NOT NULL);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_closed_at_consistent"
    CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL));

-- Examinations: a real window, bounded duration and attempts.
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_window_order"
    CHECK ("closes_at" > "opens_at");
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_duration_range"
    CHECK ("duration_minutes" BETWEEN 1 AND 600);
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_max_attempts_range"
    CHECK ("max_attempts" BETWEEN 1 AND 5);
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_pass_percent_range"
    CHECK ("pass_percent" BETWEEN 0 AND 100);
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_title_not_blank"
    CHECK (length(btrim("title")) > 0);
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_published_at_consistent"
    CHECK ("status" = 'DRAFT' OR "published_at" IS NOT NULL);
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_closed_at_consistent"
    CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL));

-- Questions belong to exactly one assessment; marks are positive, penalties within [0, marks].
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_single_owner"
    CHECK (("quiz_id" IS NULL) <> ("examination_id" IS NULL));
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_marks_range"
    CHECK ("marks" > 0 AND "marks" <= 100);
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_negative_marks_range"
    CHECK ("negative_marks" >= 0 AND "negative_marks" <= "marks");
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_position_non_negative"
    CHECK ("position" >= 0);
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_prompt_not_blank"
    CHECK (length(btrim("prompt")) > 0);
ALTER TABLE "assessment_question_options" ADD CONSTRAINT "assessment_question_options_position_non_negative"
    CHECK ("position" >= 0);

-- Attempts: one owner assessment; numbers from 1; consistent finalization and scores.
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_single_owner"
    CHECK (("quiz_id" IS NULL) <> ("examination_id" IS NULL));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_number_positive"
    CHECK ("attempt_number" >= 1);
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_deadline_after_start"
    CHECK ("deadline_at" IS NULL OR "deadline_at" > "started_at");
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_finalized_consistent"
    CHECK (("status" = 'IN_PROGRESS') = ("finalized_at" IS NULL)
       AND ("status" = 'IN_PROGRESS') = ("submitted_at" IS NULL)
       AND ("status" = 'IN_PROGRESS') = ("evaluation_status" IS NULL));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_expired_has_deadline"
    CHECK ("status" <> 'EXPIRED' OR "deadline_at" IS NOT NULL);
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_scores_non_negative"
    CHECK ("max_score" >= 0
       AND ("raw_score" IS NULL OR "raw_score" >= 0)
       AND ("penalty" IS NULL OR "penalty" >= 0)
       AND ("score" IS NULL OR ("score" >= 0 AND "score" <= "max_score"))
       AND ("percent" IS NULL OR "percent" BETWEEN 0 AND 100));
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_evaluated_consistent"
    CHECK (("evaluation_status" = 'EVALUATED') = ("score" IS NOT NULL AND "evaluated_at" IS NOT NULL AND "passed" IS NOT NULL));

-- Attempt questions: marks within the snapshot's bounds.
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_marks_range"
    CHECK ("marks" > 0 AND "negative_marks" >= 0 AND "negative_marks" <= "marks");
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_awarded_range"
    CHECK ("awarded_marks" IS NULL OR ("awarded_marks" >= 0 AND "awarded_marks" <= "marks"));
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_penalty_range"
    CHECK ("penalty" IS NULL OR ("penalty" >= 0 AND "penalty" <= "negative_marks"));
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_sequence_non_negative"
    CHECK ("answer_sequence" >= 0);
