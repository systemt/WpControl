-- =============================================================================
-- Multi-tenant + command-queue migration
-- From: init baseline (admin_users, sites w/o userId, basic site_commands)
-- To:   current schema (users, plans, subscriptions, sites.userId, site_commands
--       with queue/retry columns, audit_logs)
--
-- Safe to run via `prisma migrate deploy` on a populated Render database. The
-- whole file executes in a single transaction (Prisma's default) — any failure
-- rolls the database back to its pre-migration state. No superuser privileges
-- are required.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rename admin_users → users and adjust its defaults.
--    The seeded `admin@digiforce.local` row is preserved — it's the source for
--    the sites.userId backfill in step 3.
-- -----------------------------------------------------------------------------

ALTER TABLE "admin_users" RENAME TO "users";
ALTER INDEX "admin_users_pkey" RENAME TO "users_pkey";
ALTER INDEX "admin_users_email_key" RENAME TO "users_email_key";

-- New signups default to role='user' (schema default shift). The existing
-- admin row keeps role='admin'.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';

-- -----------------------------------------------------------------------------
-- 2. Create `plans` (additive, no data migration).
-- -----------------------------------------------------------------------------

CREATE TABLE "plans" (
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

CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- -----------------------------------------------------------------------------
-- 3. Create `subscriptions` (additive, FK to users + plans).
-- -----------------------------------------------------------------------------

CREATE TABLE "subscriptions" (
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

CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Add sites.userId safely.
--    a. nullable first (existing rows can exist)
--    b. backfill from the seeded admin
--    c. hard guard: abort if any row is still NULL
--    d. enforce NOT NULL + FK + index
-- -----------------------------------------------------------------------------

ALTER TABLE "sites" ADD COLUMN "userId" TEXT;

UPDATE "sites"
   SET "userId" = (
     SELECT "id" FROM "users"
      WHERE "email" = 'admin@digiforce.local'
      LIMIT 1
   )
 WHERE "userId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sites" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION
      'Cannot finalize migration: % site(s) still have NULL "userId". Ensure admin@digiforce.local exists in "users" and re-run.',
      (SELECT COUNT(*) FROM "sites" WHERE "userId" IS NULL);
  END IF;
END $$;

ALTER TABLE "sites" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "sites"
  ADD CONSTRAINT "sites_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "sites_userId_idx" ON "sites"("userId");

-- -----------------------------------------------------------------------------
-- 5. Extend site_commands with queue + retry columns (v1.6 / v1.7 schema).
--    All additions are nullable or have defaults, so backfill is unnecessary.
-- -----------------------------------------------------------------------------

ALTER TABLE "site_commands" ADD COLUMN "userId"          TEXT;
ALTER TABLE "site_commands" ADD COLUMN "attempt"         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "site_commands" ADD COLUMN "parentCommandId" TEXT;
ALTER TABLE "site_commands" ADD COLUMN "lockedAt"        TIMESTAMP(3);
ALTER TABLE "site_commands" ADD COLUMN "lockedBy"        TEXT;

CREATE INDEX "site_commands_status_lockedAt_idx"   ON "site_commands"("status", "lockedAt");
CREATE INDEX "site_commands_parentCommandId_idx"   ON "site_commands"("parentCommandId");
CREATE INDEX "site_commands_userId_idx"            ON "site_commands"("userId");

-- `userId` is nullable on purpose (system / cron commands have no actor); on
-- user deletion we null it rather than cascade-delete the audit row.
ALTER TABLE "site_commands"
  ADD CONSTRAINT "site_commands_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 6. Create audit_logs (impersonation audit trail; room for future system
--    actions). No FKs by design — actor/target user may be deleted without
--    erasing history.
-- -----------------------------------------------------------------------------

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_createdAt_idx"               ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_actorUserId_createdAt_idx"   ON "audit_logs"("actorUserId", "createdAt");
CREATE INDEX "audit_logs_action_createdAt_idx"        ON "audit_logs"("action", "createdAt");
