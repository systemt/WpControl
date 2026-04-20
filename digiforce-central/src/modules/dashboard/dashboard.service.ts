import { prisma } from '../../lib/prisma';

export async function getSummary() {
  const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalSites,
    connectedSites,
    inactiveSites,
    totalCommands,
    pendingCommands,
    failedCommands,
    recentLogs,
    sitesWithUpdates,
  ] = await Promise.all([
    prisma.site.count(),
    prisma.site.count({ where: { status: 'connected' } }),
    prisma.site.count({ where: { status: { in: ['disconnected', 'disabled', 'unknown'] } } }),
    prisma.siteCommand.count(),
    prisma.siteCommand.count({ where: { status: 'pending' } }),
    prisma.siteCommand.count({ where: { status: 'failed' } }),
    prisma.siteLog.count({ where: { createdAt: { gte: recentSince } } }),
    prisma.site.count({
      where: {
        OR: [
          { pluginSnapshots: { some: { hasUpdate: true } } },
          { themeSnapshots: { some: { hasUpdate: true } } },
          { coreSnapshot: { hasUpdate: true } },
        ],
      },
    }),
  ]);

  return {
    totalSites,
    activeSites: connectedSites,
    connectedSites,
    inactiveSites,
    sitesWithUpdates,
    totalCommands,
    pendingCommands,
    failedCommands,
    recentLogs,
    recentLogsWindowHours: 24,
  };
}
