"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSites = listSites;
exports.getSite = getSite;
exports.createSite = createSite;
exports.updateSite = updateSite;
exports.deleteSite = deleteSite;
exports.listSitePlugins = listSitePlugins;
exports.listSiteThemes = listSiteThemes;
exports.getSiteCore = getSiteCore;
const crypto_1 = require("crypto");
const prisma_1 = require("../../lib/prisma");
const api_error_1 = require("../../utils/api-error");
function redactConnectionSecret(connection) {
    if (!connection)
        return null;
    return { ...connection, secretKeyEncrypted: '[REDACTED]' };
}
/** Unless the caller is an admin, restrict queries to their own rows. */
function scopeByUser(actor, where) {
    if (actor.role === 'admin')
        return where;
    return { ...where, userId: actor.id };
}
async function listSites(actor, extraWhere = {}) {
    return prisma_1.prisma.site.findMany({
        where: scopeByUser(actor, extraWhere),
        orderBy: { createdAt: 'desc' },
        include: {
            connection: {
                select: {
                    id: true,
                    connectionEnabled: true,
                    requireSignedRequests: true,
                    allowedIps: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            coreSnapshot: { select: { hasUpdate: true, latestVersion: true, currentVersion: true } },
            _count: { select: { pluginSnapshots: true, themeSnapshots: true } },
        },
    });
}
async function getSite(actor, id) {
    const site = await prisma_1.prisma.site.findUnique({
        where: { id },
        include: {
            connection: true,
            coreSnapshot: true,
            _count: { select: { pluginSnapshots: true, themeSnapshots: true } },
        },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    const [pluginsNeedingUpdate, themesNeedingUpdate] = await Promise.all([
        prisma_1.prisma.sitePluginSnapshot.count({ where: { siteId: site.id, hasUpdate: true } }),
        prisma_1.prisma.siteThemeSnapshot.count({ where: { siteId: site.id, hasUpdate: true } }),
    ]);
    return {
        ...site,
        connection: redactConnectionSecret(site.connection),
        pluginCounts: {
            total: site._count.pluginSnapshots,
            needUpdate: pluginsNeedingUpdate,
        },
        themeCounts: {
            total: site._count.themeSnapshots,
            needUpdate: themesNeedingUpdate,
        },
    };
}
/**
 * Create a site under the caller's account. The route layer must also apply
 * `requireSiteQuota` middleware so plan limits are enforced before we reach
 * this call.
 */
async function createSite(actor, input) {
    const uuid = input.uuid ?? (0, crypto_1.randomUUID)();
    const existing = await prisma_1.prisma.site.findUnique({ where: { uuid } });
    if (existing)
        throw api_error_1.ApiError.conflict('A site with this UUID already exists');
    const secretKey = input.secretKey ?? (0, crypto_1.randomBytes)(48).toString('hex');
    const site = await prisma_1.prisma.site.create({
        data: {
            uuid,
            userId: actor.id,
            name: input.name,
            url: input.url,
            environment: input.environment,
            status: input.status,
            centralNotes: input.centralNotes ?? null,
            connection: {
                create: {
                    secretKeyEncrypted: secretKey,
                    allowedIps: input.allowedIps,
                    requireSignedRequests: input.requireSignedRequests,
                    connectionEnabled: input.connectionEnabled,
                },
            },
        },
        include: { connection: true },
    });
    return {
        ...site,
        connection: redactConnectionSecret(site.connection),
        secretKey,
    };
}
async function updateSite(actor, id, input) {
    const existing = await prisma_1.prisma.site.findUnique({ where: { id } });
    if (!existing)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && existing.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    const site = await prisma_1.prisma.site.update({
        where: { id },
        data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.url !== undefined ? { url: input.url } : {}),
            ...(input.environment !== undefined ? { environment: input.environment } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.centralNotes !== undefined ? { centralNotes: input.centralNotes } : {}),
        },
        include: { connection: true },
    });
    return { ...site, connection: redactConnectionSecret(site.connection) };
}
async function deleteSite(actor, id) {
    const existing = await prisma_1.prisma.site.findUnique({ where: { id } });
    if (!existing)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && existing.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    await prisma_1.prisma.site.delete({ where: { id } });
}
async function listSitePlugins(actor, siteId) {
    const site = await prisma_1.prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, userId: true },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    return prisma_1.prisma.sitePluginSnapshot.findMany({
        where: { siteId },
        orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
    });
}
async function listSiteThemes(actor, siteId) {
    const site = await prisma_1.prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, userId: true },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    return prisma_1.prisma.siteThemeSnapshot.findMany({
        where: { siteId },
        orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
    });
}
async function getSiteCore(actor, siteId) {
    const site = await prisma_1.prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, userId: true },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    return prisma_1.prisma.siteCoreSnapshot.findUnique({ where: { siteId } }) ?? null;
}
//# sourceMappingURL=sites.service.js.map