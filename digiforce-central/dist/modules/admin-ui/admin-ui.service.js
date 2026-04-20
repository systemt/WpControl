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
const prisma_1 = require("../../lib/prisma");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const sitesService = __importStar(require("../sites/sites.service"));
async function loadDashboard() {
    const [summary, recentSites, recentLogs] = await Promise.all([
        (0, dashboard_service_1.getSummary)(),
        prisma_1.prisma.site.findMany({
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
            orderBy: { createdAt: 'desc' },
            take: 15,
            include: { site: { select: { id: true, name: true } } },
        }),
    ]);
    return { summary, recentSites, recentLogs };
}
async function listSites(filters) {
    const where = {};
    const q = filters.q?.trim();
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { url: { contains: q, mode: 'insensitive' } },
        ];
    }
    if (filters.status) {
        where.status = filters.status;
    }
    return prisma_1.prisma.site.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            connection: { select: { connectionEnabled: true, requireSignedRequests: true } },
        },
    });
}
async function getSiteDetail(id) {
    const site = await sitesService.getSite(id);
    const [plugins, themes, core, logs] = await Promise.all([
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
    ]);
    return { site, plugins, themes, core, logs };
}
async function listLogs(filters) {
    const where = {};
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
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);
    return { logs, sites };
}
//# sourceMappingURL=admin-ui.service.js.map