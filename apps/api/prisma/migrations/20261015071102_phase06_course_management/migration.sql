-- CreateEnum
CREATE TYPE "course_visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "lesson_content_type" ADD VALUE 'PDF';
ALTER TYPE "lesson_content_type" ADD VALUE 'QUIZ';
ALTER TYPE "lesson_content_type" ADD VALUE 'ASSIGNMENT';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "currency" CHAR(3),
ADD COLUMN     "discount_type" "discount_type",
ADD COLUMN     "discount_value" INTEGER,
ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "price_minor" INTEGER,
ADD COLUMN     "thumbnail_url" VARCHAR(2048),
ADD COLUMN     "visibility" "course_visibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "courses_status_visibility_idx" ON "courses"("status", "visibility");

-- =============================================================================
-- PHASE 06 CHECK constraints (hand-written: Prisma schema cannot express them).
-- Mirrored by the Zod schemas in @asra/validation (courses.ts) for field-level API errors.
-- Documented in docs/DATABASE.md §Constraints.
-- =============================================================================

-- Duration is the estimated total learning time in minutes.
ALTER TABLE "courses" ADD CONSTRAINT "courses_duration_minutes_positive"
    CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0);

-- Price: minor units (e.g. paise), never negative, always with an ISO 4217 currency code.
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_minor_non_negative"
    CHECK ("price_minor" IS NULL OR "price_minor" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_currency_consistent"
    CHECK (("price_minor" IS NULL) = ("currency" IS NULL));
ALTER TABLE "courses" ADD CONSTRAINT "courses_currency_format"
    CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$');

-- Discount: type and value together, only on a paid course, within range for its type.
ALTER TABLE "courses" ADD CONSTRAINT "courses_discount_consistent"
    CHECK (("discount_type" IS NULL) = ("discount_value" IS NULL));
ALTER TABLE "courses" ADD CONSTRAINT "courses_discount_requires_price"
    CHECK ("discount_type" IS NULL OR "price_minor" > 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_discount_value_valid"
    CHECK (
        "discount_type" IS NULL
        OR ("discount_type" = 'PERCENTAGE' AND "discount_value" BETWEEN 1 AND 100)
        OR ("discount_type" = 'FIXED_AMOUNT' AND "discount_value" >= 1 AND "discount_value" <= "price_minor")
    );

-- Cover image: a storage key OR an HTTPS URL, never both.
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_location_exclusive"
    CHECK ("thumbnail_key" IS NULL OR "thumbnail_url" IS NULL);
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_url_https"
    CHECK ("thumbnail_url" IS NULL OR "thumbnail_url" ~ '^https://');
