"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDashboard = loadDashboard;
exports.listSites = listSites;
exports.getSiteDetail = getSiteDetail;
exports.listLogs = listLogs;
exports.listAllUsers = listAllUsers;
const prisma_1 = require("../../lib/prisma");
const sitesService = __importStar(require("../sites/sites.service"));
const RECENTLY_SEEN_MS = 15 * 60 * 1000;
function scopeSites(actor, where = {}) {
    if (actor.role === 'admin')
        return where;
    return { ...where, userId: actor.id };
}
function scopeLogs(actor, where = {}) {
    if (actor.role === 'admin')
        return where;
    return { ...where, site: { userId: actor.id } };
}
async function loadDashboard(actor) {
    const siteWhere = scopeSites(actor);
    const logWhere = scopeLogs(actor);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalSites, connectedSites, inactiveSites, sitesWithUpdates, totalCommands, failedCommands, recentLogsCount, recentSites, recentLogs, subscription,] = await Promise.all([
        prisma_1.prisma.site.count({ where: siteWhere }),
        prisma_1.prisma.site.count({ where: { ...siteWhere, status: 'connected' } }),
        prisma_1.prisma.site.count({ where: { ...siteWhere, status: { in: ['disconnected', 'disabled', 'unknown'] } } }),
        prisma_1.prisma.site.count({
            where: {
                ...siteWhere,
                OR: [
                    { pluginSnapshots: { some: { hasUpdate: true } } },
                    { themeSnapshots: { some: { hasUpdate: true } } },
                    { coreSnapshot: { hasUpdate: true } },
                ],
            },
        }),
        prisma_1.prisma.siteCommand.count({ where: { site: siteWhere } }),
        prisma_1.prisma.siteCommand.count({ where: { site: siteWhere, status: 'failed' } }),
        prisma_1.prisma.siteLog.count({ where: { ...logWhere, createdAt: { gte: since } } }),
        prisma_1.prisma.site.findMany({
            where: siteWhere,
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                url: true,
                environment: true,
                status: true,
                lastSeenAt: true,
                lastSyncAt: true,
            },
        }),
        prisma_1.prisma.siteLog.findMany({
            where: logWhere,
            orderBy: { createdAt: 'desc' },
            take: 15,
            include: { site: { select: { id: true, name: true } } },
        }),
        actor.role === 'admin'
            ? null
            : prisma_1.prisma.subscription.findUnique({
                where: { userId: actor.id },
                include: { plan: true },
            }),
    ]);
    return {
        summary: {
            totalSites,
            connectedSites,
            activeSites: connectedSites,
            inactiveSites,
            sitesWithUpdates,
            totalCommands,
            pendingCommands: 0,
            failedCommands,
            recentLogs: recentLogsCount,
            recentLogsWindowHours: 24,
        },
        recentSites,
        recentLogs,
        subscription,
    };
}
async function listSites(actor, filters) {
    const where = scopeSites(actor);
    const q = filters.q?.trim();
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { url: { contains: q, mode: 'insensitive' } },
        ];
    }
    if (filters.status)
        where.status = filters.status;
    if (filters.environment)
        where.environment = filters.environment;
    return prisma_1.prisma.site.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            connection: { select: { connectionEnabled: true, requireSignedRequests: true } },
        },
    });
}
async function getSiteDetail(actor, id) {
    const site = await sitesService.getSite({ id: actor.id, role: actor.role }, id);
    const [plugins, themes, core, logs, commands] = await Promise.all([
        prisma_1.prisma.sitePluginSnapshot.findMany({
            where: { siteId: id },
            orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
            take: 200,
        }),
        prisma_1.prisma.siteThemeSnapshot.findMany({
            where: { siteId: id },
            orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
        }),
        prisma_1.prisma.siteCoreSnapshot.findUnique({ where: { siteId: id } }),
        prisma_1.prisma.siteLog.findMany({
            where: { siteId: id },
            orderBy: { createdAt: 'desc' },
            take: 30,
        }),
        prisma_1.prisma.siteCommand.findMany({
            where: { siteId: id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
    ]);
    const recentlySeen = Boolean(site.lastSeenAt && Date.now() - new Date(site.lastSeenAt).getTime() < RECENTLY_SEEN_MS);
    return { site, plugins, themes, core, logs, commands, recentlySeen };
}
async function listLogs(actor, filters) {
    const where = scopeLogs(actor);
    if (filters.level)
        where.level = filters.level;
    if (filters.category)
        where.category = filters.category;
    if (filters.siteId)
        where.siteId = filters.siteId;
    const [logs, sites] = await Promise.all([
        prisma_1.prisma.siteLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: { site: { select: { id: true, name: true } } },
        }),
        prisma_1.prisma.site.findMany({
            where: scopeSites(actor),
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);
    return { logs, sites };
}
/**
 * Admin-only tenant overview. Returns every user with their site count,
 * subscription plan (if any), and role so the impersonation page can render
 * a single-screen directory.
 */
async function listAllUsers() {
    const users = await prisma_1.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            subscription: { include: { plan: { select: { name: true, slug: true } } } },
            _count: { select: { sites: true } },
        },
    });
    return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        siteCount: u._count.sites,
        planName: u.subscription?.plan.name ?? null,
        subscriptionStatus: u.subscription?.status ?? null,
    }));
}
//# sourceMappingURL=admin-ui.service.js.map