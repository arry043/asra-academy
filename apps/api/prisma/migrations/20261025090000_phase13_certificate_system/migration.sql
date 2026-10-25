-- PHASE 13 — Certificate System (docs/CERTIFICATE-SYSTEM.md)
-- Adds the certificate credential table, indexes, foreign keys, and integrity check constraints.

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "certificate_number" VARCHAR(50) NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "recipient_name" VARCHAR(150) NOT NULL,
    "course_title" VARCHAR(200) NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "certificate_status" NOT NULL DEFAULT 'ISSUED',
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(500),
    "metadata" JSONB,
    "issued_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_number_key" ON "certificates"("certificate_number");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");

-- CreateIndex
CREATE INDEX "certificates_user_id_status_issued_at_idx" ON "certificates"("user_id", "status", "issued_at");

-- CreateIndex
CREATE INDEX "certificates_course_id_status_idx" ON "certificates"("course_id", "status");

-- CreateIndex
CREATE INDEX "certificates_status_issued_at_idx" ON "certificates"("status", "issued_at");

-- CreateIndex
CREATE INDEX "certificates_issued_by_id_idx" ON "certificates"("issued_by_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PHASE 13 CHECK constraints
-- =============================================================================

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_certificate_number_format"
    CHECK ("certificate_number" ~ '^ASRA-[0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$');

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revocation_consistency"
    CHECK (("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" = 'ISSUED' AND "revoked_at" IS NULL));

