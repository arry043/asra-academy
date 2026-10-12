-- Runs once, when the local PostgreSQL volume is first initialised.
-- Local development only. Production (Neon) extensions are enabled through Prisma migrations.
--
-- pgcrypto provides gen_random_uuid() and is also available on Neon,
-- keeping local and production databases aligned.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
