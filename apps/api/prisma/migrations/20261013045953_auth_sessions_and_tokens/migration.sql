-- CreateEnum
CREATE TYPE "session_revocation_reason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'TOKEN_REUSE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "one_time_token_purpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "previous_token_hash" CHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" "session_revocation_reason",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "one_time_token_purpose" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_previous_token_hash_key" ON "auth_sessions"("previous_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_token_hash_key" ON "one_time_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "one_time_tokens_user_id_purpose_idx" ON "one_time_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "one_time_tokens_expires_at_idx" ON "one_time_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- CHECK constraints (hand-written; see docs/DATABASE.md §4.2 and docs/AUTHENTICATION.md).
-- =============================================================================

-- Only lower-case hex SHA-256 digests may be stored — never a raw token.
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_token_hash_format"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_previous_token_hash_format"
    CHECK ("previous_token_hash" IS NULL OR "previous_token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_token_hash_format"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- A revoked session always records why; an active one has no reason.
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_revocation_consistent"
    CHECK (("revoked_at" IS NULL) = ("revoked_reason" IS NULL));

-- Expiry must be after creation.
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_expires_after_created"
    CHECK ("expires_at" > "created_at");
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_expires_after_created"
    CHECK ("expires_at" > "created_at");
