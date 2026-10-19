-- PHASE 10 — Enrolment & Payment (docs/PAYMENTS.md, docs/DATABASE.md §Payments).
-- Additive only: new enums/tables, one nullable column on enrollments, one new enum value.
-- No existing row is modified or deleted.

-- CreateEnum
CREATE TYPE "payment_mode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('CREATED', 'PENDING', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('REQUESTED', 'PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterEnum
ALTER TYPE "enrollment_source" ADD VALUE 'PAYMENT';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "order_id" UUID;

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'CREATED',
    "provider" "payment_provider" NOT NULL DEFAULT 'RAZORPAY',
    "mode" "payment_mode" NOT NULL,
    "provider_key_id" VARCHAR(64) NOT NULL,
    "provider_order_id" VARCHAR(64),
    "currency" CHAR(3) NOT NULL,
    "course_title" VARCHAR(200) NOT NULL,
    "list_price_minor" INTEGER NOT NULL,
    "discount_type" "discount_type",
    "discount_value" INTEGER,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "amount_minor" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "failure_reason" VARCHAR(500),
    "last_reconciled_at" TIMESTAMPTZ(3),
    "reconcile_attempts" INTEGER NOT NULL DEFAULT 0,
    "confirmation_email_claimed_at" TIMESTAMPTZ(3),
    "confirmation_email_sent_at" TIMESTAMPTZ(3),
    "confirmation_email_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'RAZORPAY',
    "mode" "payment_mode" NOT NULL,
    "provider_payment_id" VARCHAR(64) NOT NULL,
    "provider_order_id" VARCHAR(64) NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" VARCHAR(30),
    "error_code" VARCHAR(100),
    "error_description" VARCHAR(500),
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "signature_verified_at" TIMESTAMPTZ(3),
    "authorized_at" TIMESTAMPTZ(3),
    "captured_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "applied_at" TIMESTAMPTZ(3),
    "review_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'RAZORPAY',
    "mode" "payment_mode" NOT NULL,
    "receipt" VARCHAR(40),
    "idempotency_key" VARCHAR(64),
    "provider_refund_id" VARCHAR(64),
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "refund_status" NOT NULL,
    "reason" VARCHAR(500),
    "failure_reason" VARCHAR(500),
    "requested_by_id" UUID,
    "revoked_access" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMPTZ(3),
    "notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "payment_provider" NOT NULL DEFAULT 'RAZORPAY',
    "mode" "payment_mode" NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "status" "webhook_event_status" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload_hash" CHAR(64) NOT NULL,
    "data" JSONB NOT NULL,
    "note" VARCHAR(500),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(60) NOT NULL,
    "actor_id" UUID,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_order_id_key" ON "orders"("provider_order_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_course_id_idx" ON "orders"("course_id");

-- CreateIndex
CREATE INDEX "orders_status_mode_created_at_idx" ON "orders"("status", "mode", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_last_reconciled_at_idx" ON "orders"("status", "last_reconciled_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_mode_captured_at_idx" ON "payments"("status", "mode", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_receipt_key" ON "refunds"("receipt");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_provider_refund_id_key" ON "refunds"("provider_refund_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_mode_created_at_idx" ON "refunds"("status", "mode", "created_at");

-- CreateIndex
CREATE INDEX "refunds_requested_by_id_idx" ON "refunds"("requested_by_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_status_received_at_idx" ON "payment_webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_mode_event_id_key" ON "payment_webhook_events"("provider", "mode", "event_id");

-- CreateIndex
CREATE INDEX "payment_audit_logs_entity_type_entity_id_created_at_idx" ON "payment_audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_audit_logs_actor_id_idx" ON "payment_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "enrollments_order_id_idx" ON "enrollments"("order_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Constraints Prisma cannot express (listed in docs/DATABASE.md §Constraints)
-- =============================================================================

-- One open (CREATED/PENDING) order per student and course: concurrent checkouts from two tabs
-- resolve to the same order instead of two chargeable ones.
CREATE UNIQUE INDEX "orders_one_open_per_student_course"
    ON "orders" ("user_id", "course_id") WHERE "status" IN ('CREATED', 'PENDING');

-- Orders: non-negative integer money; amount = list price − discount; currency is ISO 4217 upper.
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid"
    CHECK ("list_price_minor" >= 0 AND "discount_minor" >= 0
       AND "discount_minor" <= "list_price_minor"
       AND "amount_minor" = "list_price_minor" - "discount_minor");
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_pair"
    CHECK (("discount_type" IS NULL) = ("discount_value" IS NULL));
-- A PENDING or PAID order always has its provider order; PAID always has a time.
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_order_when_open"
    CHECK ("status" NOT IN ('PENDING', 'PAID') OR "provider_order_id" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_consistent"
    CHECK (("status" = 'PAID') = ("paid_at" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_counters_non_negative"
    CHECK ("reconcile_attempts" >= 0 AND "confirmation_email_attempts" >= 0);

-- Payments: positive amounts; refunds never exceed the payment; capture time ⇔ CAPTURED.
ALTER TABLE "payments" ADD CONSTRAINT "payments_amounts_valid"
    CHECK ("amount_minor" > 0 AND "refunded_minor" >= 0 AND "refunded_minor" <= "amount_minor");
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "payments" ADD CONSTRAINT "payments_captured_consistent"
    CHECK (("status" = 'CAPTURED') = ("captured_at" IS NOT NULL));
ALTER TABLE "payments" ADD CONSTRAINT "payments_applied_requires_capture"
    CHECK ("applied_at" IS NULL OR "status" = 'CAPTURED');
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_requires_capture"
    CHECK ("refunded_minor" = 0 OR "status" = 'CAPTURED');

-- Refunds: positive amount; PROCESSED has a time.
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_minor" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_consistent"
    CHECK (("status" = 'PROCESSED') = ("processed_at" IS NOT NULL));

-- Webhook events: SHA-256 hex; non-negative attempt counter.
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_hash_format"
    CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_attempts_non_negative"
    CHECK ("attempts" >= 0);
