"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = getSummary;
const prisma_1 = require("../../lib/prisma");
async function getSummary() {
    const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalSites, connectedSites, inactiveSites, totalCommands, pendingCommands, failedCommands, recentLogs, sitesWithUpdates,] = await Promise.all([
        prisma_1.prisma.site.count(),
        prisma_1.prisma.site.count({ where: { status: 'connected' } }),
        prisma_1.prisma.site.count({ where: { status: { in: ['disconnected', 'disabled', 'unknown'] } } }),
        prisma_1.prisma.siteCommand.count(),
        prisma_1.prisma.siteCommand.count({ where: { status: 'pending' } }),
        prisma_1.prisma.siteCommand.count({ where: { status: 'failed' } }),
        prisma_1.prisma.siteLog.count({ where: { createdAt: { gte: recentSince } } }),
        prisma_1.prisma.site.count({
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
//# sourceMappingURL=dashboard.service.js.map