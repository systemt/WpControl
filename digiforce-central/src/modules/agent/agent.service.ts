import type { Site, SiteConnection } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import type { HeartbeatInput, RegisterInput, SyncInput } from './agent.schema';

const CONNECTED_STATUS = 'connected';

export async function registerAgent(
  site: Site,
  _connection: SiteConnection,
  input: RegisterInput
) {
  const updated = await prisma.site.update({
    where: { id: site.id },
    data: {
      name: input.site_name ?? site.name,
      url: input.site_url ?? site.url,
      environment: input.environment ?? site.environment,
      wpVersion: input.wordpress_version ?? site.wpVersion,
      phpVersion: input.php_version ?? site.phpVersion,
      pluginVersion: input.plugin_version ?? site.pluginVersion,
      status: CONNECTED_STATUS,
      lastSeenAt: new Date(),
    },
  });

  await prisma.siteLog.create({
    data: {
      siteId: site.id,
      level: 'info',
      category: 'register',
      message: `Site ${updated.name} registered from ${updated.url}.`,
      metaJson: {
        adminEmail: input.admin_email ?? null,
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        activeTheme: input.active_theme ?? null,
        pluginVersion: input.plugin_version ?? null,
      },
    },
  });

  return {
    siteId: updated.id,
    siteUuid: updated.uuid,
    status: updated.status,
    heartbeatIntervalMinutes: config.AGENT_HEARTBEAT_INTERVAL_MINUTES,
    syncIntervalMinutes: config.AGENT_SYNC_INTERVAL_MINUTES,
  };
}

export async function processHeartbeat(
  site: Site,
  _connection: SiteConnection,
  input: HeartbeatInput
) {
  await prisma.site.update({
    where: { id: site.id },
    data: {
      wpVersion: input.wordpress_version ?? site.wpVersion,
      phpVersion: input.php_version ?? site.phpVersion,
      pluginVersion: input.plugin_version ?? site.pluginVersion,
      status: CONNECTED_STATUS,
      lastSeenAt: new Date(),
    },
  });

  await prisma.siteLog.create({
    data: {
      siteId: site.id,
      level: 'info',
      category: 'heartbeat',
      message: 'Heartbeat received.',
      metaJson: {
        reportedAt: input.last_seen_at ?? null,
        pluginVersion: input.plugin_version ?? null,
        summary: input.summary ?? null,
      },
    },
  });

  return {
    acknowledged: true,
    receivedAt: new Date().toISOString(),
  };
}

export async function processSync(
  site: Site,
  _connection: SiteConnection,
  input: SyncInput
) {
  const now = new Date();
  const incomingPluginFiles = input.plugins.map((p) => p.plugin_file);
  const incomingStylesheets = input.themes.map((t) => t.stylesheet);

  const saved = await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: site.id },
      data: {
        status: CONNECTED_STATUS,
        lastSeenAt: now,
        lastSyncAt: now,
      },
    });

    // Plugins: upsert each, then delete rows no longer present.
    for (const p of input.plugins) {
      const payload = {
        slug: p.slug ?? null,
        name: p.name ?? null,
        versionInstalled: p.version_installed ?? null,
        versionAvailable: p.version_available ?? null,
        hasUpdate: p.has_update,
        isActive: p.is_active,
        autoUpdateEnabled: p.auto_update_enabled,
        author: p.author ?? null,
        requiresWp: p.requires_wp ?? null,
        requiresPhp: p.requires_php ?? null,
        lastSyncedAt: now,
      };
      await tx.sitePluginSnapshot.upsert({
        where: { siteId_pluginFile: { siteId: site.id, pluginFile: p.plugin_file } },
        create: { siteId: site.id, pluginFile: p.plugin_file, ...payload },
        update: payload,
      });
    }
    if (incomingPluginFiles.length > 0) {
      await tx.sitePluginSnapshot.deleteMany({
        where: { siteId: site.id, pluginFile: { notIn: incomingPluginFiles } },
      });
    } else {
      await tx.sitePluginSnapshot.deleteMany({ where: { siteId: site.id } });
    }

    // Themes: same strategy.
    for (const t of input.themes) {
      const payload = {
        template: t.template ?? null,
        name: t.name ?? null,
        versionInstalled: t.version_installed ?? null,
        versionAvailable: t.version_available ?? null,
        hasUpdate: t.has_update,
        isActive: t.is_active,
        autoUpdateEnabled: t.auto_update_enabled,
        lastSyncedAt: now,
      };
      await tx.siteThemeSnapshot.upsert({
        where: { siteId_stylesheet: { siteId: site.id, stylesheet: t.stylesheet } },
        create: { siteId: site.id, stylesheet: t.stylesheet, ...payload },
        update: payload,
      });
    }
    if (incomingStylesheets.length > 0) {
      await tx.siteThemeSnapshot.deleteMany({
        where: { siteId: site.id, stylesheet: { notIn: incomingStylesheets } },
      });
    } else {
      await tx.siteThemeSnapshot.deleteMany({ where: { siteId: site.id } });
    }

    // Core: single row per site.
    const corePayload = {
      currentVersion: input.core.current_version,
      latestVersion: input.core.latest_version,
      hasUpdate: input.core.has_update,
      updateType: input.core.update_type ?? null,
      lastSyncedAt: now,
    };
    await tx.siteCoreSnapshot.upsert({
      where: { siteId: site.id },
      create: { siteId: site.id, ...corePayload },
      update: corePayload,
    });

    return {
      pluginsSaved: input.plugins.length,
      themesSaved: input.themes.length,
      coreSaved: true,
    };
  });

  await prisma.siteLog.create({
    data: {
      siteId: site.id,
      level: 'info',
      category: 'sync',
      message: 'Sync applied.',
      metaJson: {
        syncedAt: input.synced_at ?? null,
        ...saved,
      },
    },
  });

  return saved;
}
