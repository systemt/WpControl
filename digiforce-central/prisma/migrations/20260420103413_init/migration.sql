-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "centralNotes" TEXT,
    "wpVersion" TEXT,
    "phpVersion" TEXT,
    "pluginVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_connections" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT NOT NULL,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireSignedRequests" BOOLEAN NOT NULL DEFAULT true,
    "connectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_commands" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responseJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "site_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_plugin_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pluginFile" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT,
    "versionInstalled" TEXT,
    "versionAvailable" TEXT,
    "hasUpdate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "author" TEXT,
    "requiresWp" TEXT,
    "requiresPhp" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_plugin_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_theme_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "stylesheet" TEXT NOT NULL,
    "template" TEXT,
    "name" TEXT,
    "versionInstalled" TEXT,
    "versionAvailable" TEXT,
    "hasUpdate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_theme_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_core_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "hasUpdate" BOOLEAN NOT NULL DEFAULT false,
    "updateType" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_core_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sites_uuid_key" ON "sites"("uuid");

-- CreateIndex
CREATE INDEX "sites_status_idx" ON "sites"("status");

-- CreateIndex
CREATE INDEX "sites_environment_idx" ON "sites"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "site_connections_siteId_key" ON "site_connections"("siteId");

-- CreateIndex
CREATE INDEX "site_logs_siteId_createdAt_idx" ON "site_logs"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "site_logs_level_idx" ON "site_logs"("level");

-- CreateIndex
CREATE INDEX "site_logs_category_idx" ON "site_logs"("category");

-- CreateIndex
CREATE UNIQUE INDEX "site_commands_commandId_key" ON "site_commands"("commandId");

-- CreateIndex
CREATE INDEX "site_commands_siteId_status_idx" ON "site_commands"("siteId", "status");

-- CreateIndex
CREATE INDEX "site_commands_status_createdAt_idx" ON "site_commands"("status", "createdAt");

-- CreateIndex
CREATE INDEX "site_plugin_snapshots_siteId_hasUpdate_idx" ON "site_plugin_snapshots"("siteId", "hasUpdate");

-- CreateIndex
CREATE INDEX "site_plugin_snapshots_siteId_isActive_idx" ON "site_plugin_snapshots"("siteId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "site_plugin_snapshots_siteId_pluginFile_key" ON "site_plugin_snapshots"("siteId", "pluginFile");

-- CreateIndex
CREATE INDEX "site_theme_snapshots_siteId_hasUpdate_idx" ON "site_theme_snapshots"("siteId", "hasUpdate");

-- CreateIndex
CREATE UNIQUE INDEX "site_theme_snapshots_siteId_stylesheet_key" ON "site_theme_snapshots"("siteId", "stylesheet");

-- CreateIndex
CREATE UNIQUE INDEX "site_core_snapshots_siteId_key" ON "site_core_snapshots"("siteId");

-- AddForeignKey
ALTER TABLE "site_connections" ADD CONSTRAINT "site_connections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_commands" ADD CONSTRAINT "site_commands_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_plugin_snapshots" ADD CONSTRAINT "site_plugin_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_theme_snapshots" ADD CONSTRAINT "site_theme_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_core_snapshots" ADD CONSTRAINT "site_core_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
