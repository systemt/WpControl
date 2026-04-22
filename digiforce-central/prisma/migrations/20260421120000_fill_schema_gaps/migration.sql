-- =============================================================================
-- Fill-schema-gaps migration — idempotent repair.
--
-- Safe to apply on any state the DB might currently be in:
--   • fresh init baseline (admin_users only)
--   • partial multi-tenant (some but not all columns)
--   • fully migrated (this migration becomes a no-op)
--
-- Every statement is guarded with `IF NOT EXISTS`, a DO-block existence check,
-- or pg_constraint lookups so no error is raised on pre-existing objects. All
-- new columns use nullable types or defaults so no backfill is needed beyond
-- the single `sites.userId` one that still requires the seeded admin.
--
-- Column naming matches the Prisma schema (no `@map`): camelCase identifiers
-- quoted with double-quotes, because Postgres would otherwise fold them to
-- lowercase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. admin_users → users (preserves data)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE "admin_users" RENAME TO "users";
  END IF;

  -- Index renames — tolerate missing source indexes in case a prior partial
  -- run already renamed them.
  BEGIN ALTER INDEX "admin_users_pkey"      RENAME TO "users_pkey";      EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN ALTER INDEX "admin_users_email_key" RENAME TO "users_email_key"; EXCEPTION WHEN undefined_object THEN NULL; END;

  -- Default role shifts from 'admin' → 'user' for new rows only.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. plans
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxSites" INTEGER,
    "priceMonthly" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "providerPriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");

-- -----------------------------------------------------------------------------
-- 3. subscriptions (+ FKs to users and plans)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE INDEX        IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_userId_fkey') THEN
    ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_planId_fkey') THEN
    ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "plans"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. sites.userId — add nullable, backfill, enforce, FK, index. The backfill
--    + guard only runs if the column is actually being added.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'userId'
  ) THEN
    ALTER TABLE "sites" ADD COLUMN "userId" TEXT;

    UPDATE "sites"
       SET "userId" = (
         SELECT "id" FROM "users"
          WHERE "email" = 'admin@digiforce.local'
          LIMIT 1
       )
     WHERE "userId" IS NULL;

    IF EXISTS (SELECT 1 FROM "sites" WHERE "userId" IS NULL) THEN
      RAISE EXCEPTION
        'Cannot finalize migration: % site(s) still have NULL "userId". Ensure admin@digiforce.local exists in "users" and re-run.',
        (SELECT COUNT(*) FROM "sites" WHERE "userId" IS NULL);
    END IF;

    ALTER TABLE "sites" ALTER COLUMN "userId" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_userId_fkey') THEN
    ALTER TABLE "sites"
      ADD CONSTRAINT "sites_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sites_userId_idx" ON "sites"("userId");

-- -----------------------------------------------------------------------------
-- 5. site_commands queue + retry columns — the direct fix for the reported
--    "site_commands.lockedAt does not exist" runtime error.
-- -----------------------------------------------------------------------------
ALTER TABLE "site_commands" ADD COLUMN IF NOT EXISTS "userId"          TEXT;
ALTER TABLE "site_commands" ADD COLUMN IF NOT EXISTS "attempt"         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "site_commands" ADD COLUMN IF NOT EXISTS "parentCommandId" TEXT;
ALTER TABLE "site_commands" ADD COLUMN IF NOT EXISTS "lockedAt"        TIMESTAMP(3);
ALTER TABLE "site_commands" ADD COLUMN IF NOT EXISTS "lockedBy"        TEXT;

CREATE INDEX IF NOT EXISTS "site_commands_status_lockedAt_idx" ON "site_commands"("status", "lockedAt");
CREATE INDEX IF NOT EXISTS "site_commands_parentCommandId_idx" ON "site_commands"("parentCommandId");
CREATE INDEX IF NOT EXISTS "site_commands_userId_idx"          ON "site_commands"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_commands_userId_fkey') THEN
    ALTER TABLE "site_commands"
      ADD CONSTRAINT "site_commands_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"             ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx"      ON "audit_logs"("action", "createdAt");
