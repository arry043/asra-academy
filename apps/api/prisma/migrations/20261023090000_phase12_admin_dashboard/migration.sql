-- PHASE 12 — Admin Dashboard & Analytics (docs/ADMIN-DASHBOARD.md).
-- Adds the administrative audit trail and two indexes used by the analytics time series
-- (student registrations by users.created_at, enrolments by enrollments.enrolled_at).


-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(60) NOT NULL,
    "actor_id" UUID,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_created_at_idx" ON "admin_audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_idx" ON "admin_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "enrollments_enrolled_at_idx" ON "enrollments"("enrolled_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PHASE 12 CHECK constraints (hand-written: Prisma schema cannot express them).
-- =============================================================================

ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_action_format"
    CHECK ("action" ~ '^[a-z_]+\.[a-z_]+$');
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_entity_type_format"
    CHECK ("entity_type" ~ '^[a-z_]+$');
