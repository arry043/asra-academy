-- PHASE 11 — Live Classes & Notifications (docs/LIVE-CLASSES.md, docs/NOTIFICATIONS.md,
-- docs/DATABASE.md §Live classes / §Notifications).
-- Additive only: new enums/tables, nullable or defaulted columns on live_class_sessions and one new
-- enum value. No existing row is modified or deleted (existing classes get time_zone 'Asia/Kolkata').

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('REGISTRATION', 'ENROLLMENT', 'PAYMENT', 'LIVE_CLASS', 'ASSIGNMENT', 'EXAMINATION', 'RESULT', 'CERTIFICATE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "live_class_status" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "live_class_sessions" ADD COLUMN     "completed_at" TIMESTAMPTZ(3),
ADD COLUMN     "meeting_claimed_at" TIMESTAMPTZ(3),
ADD COLUMN     "meeting_last_error" VARCHAR(300),
ADD COLUMN     "provider_meeting_id" VARCHAR(255),
ADD COLUMN     "recording_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "recording_url" VARCHAR(2048),
ADD COLUMN     "time_zone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "updated_by_id" UUID;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "event" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "action_url" VARCHAR(500),
    "resource_type" VARCHAR(40),
    "resource_id" UUID,
    "data" JSONB,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(3),
    "provider_message_id" VARCHAR(100),
    "accepted_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "live_class_sessions_status_starts_at_idx" ON "live_class_sessions"("status", "starts_at");

-- CreateIndex
CREATE INDEX "live_class_sessions_updated_by_id_idx" ON "live_class_sessions"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_class_sessions_provider_provider_meeting_id_key" ON "live_class_sessions"("provider", "provider_meeting_id");

-- AddForeignKey
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- PHASE 11 CHECK constraints (hand-written: Prisma schema cannot express them).
-- The new enum value COMPLETED is compared as text: a value added by ALTER TYPE cannot be used as
-- an enum literal in the same transaction.
-- =============================================================================

ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_completed_at_consistent"
    CHECK (("status"::text = 'COMPLETED') = ("completed_at" IS NOT NULL));
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_recording_url_https"
    CHECK ("recording_url" IS NULL OR ("recording_url" LIKE 'https://%' AND "recording_updated_at" IS NOT NULL));
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_meeting_id_has_provider"
    CHECK ("provider_meeting_id" IS NULL OR "provider" IS NOT NULL);
ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_time_zone_not_blank"
    CHECK (length(btrim("time_zone")) > 0);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_format"
    CHECK ("event" ~ '^[a-z_]+\.[a-z_]+$');
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_action_url_relative"
    CHECK ("action_url" IS NULL OR ("action_url" LIKE '/%' AND "action_url" NOT LIKE '//%'));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resource_pair"
    CHECK (("resource_type" IS NULL) = ("resource_id" IS NULL));

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_attempts_non_negative"
    CHECK ("attempts" >= 0);
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_accepted_consistent"
    CHECK (("status" = 'ACCEPTED') = ("accepted_at" IS NOT NULL));
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_claim_consistent"
    CHECK (("status" = 'SENDING') = ("claimed_at" IS NOT NULL));
