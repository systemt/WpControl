import { randomBytes, randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import type { CreateSiteInput, UpdateSiteInput } from './sites.schema';

/** Caller context threaded through every read so we can scope by user. */
export interface SiteActor {
  id: string;
  role: string;
}

function redactConnectionSecret<T extends { secretKeyEncrypted: string }>(
  connection: T | null | undefined
): (T & { secretKeyEncrypted: string }) | null {
  if (!connection) return null;
  return { ...connection, secretKeyEncrypted: '[REDACTED]' };
}

/** Unless the caller is an admin, restrict queries to their own rows. */
function scopeByUser(actor: SiteActor, where: Prisma.SiteWhereInput): Prisma.SiteWhereInput {
  if (actor.role === 'admin') return where;
  return { ...where, userId: actor.id };
}

export async function listSites(actor: SiteActor, extraWhere: Prisma.SiteWhereInput = {}) {
  return prisma.site.findMany({
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

export async function getSite(actor: SiteActor, id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      connection: true,
      coreSnapshot: true,
      _count: { select: { pluginSnapshots: true, themeSnapshots: true } },
    },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && site.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }

  const [pluginsNeedingUpdate, themesNeedingUpdate] = await Promise.all([
    prisma.sitePluginSnapshot.count({ where: { siteId: site.id, hasUpdate: true } }),
    prisma.siteThemeSnapshot.count({ where: { siteId: site.id, hasUpdate: true } }),
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
export async function createSite(actor: SiteActor, input: CreateSiteInput) {
  const uuid = input.uuid ?? randomUUID();

  const existing = await prisma.site.findUnique({ where: { uuid } });
  if (existing) throw ApiError.conflict('A site with this UUID already exists');

  const secretKey = input.secretKey ?? randomBytes(48).toString('hex');

  const site = await prisma.site.create({
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

export async function updateSite(actor: SiteActor, id: string, input: UpdateSiteInput) {
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && existing.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }

  const site = await prisma.site.update({
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

export async function deleteSite(actor: SiteActor, id: string) {
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && existing.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }
  await prisma.site.delete({ where: { id } });
}

export async function listSitePlugins(actor: SiteActor, siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, userId: true },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && site.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }
  return prisma.sitePluginSnapshot.findMany({
    where: { siteId },
    orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function listSiteThemes(actor: SiteActor, siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, userId: true },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && site.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }
  return prisma.siteThemeSnapshot.findMany({
    where: { siteId },
    orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function getSiteCore(actor: SiteActor, siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, userId: true },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && site.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }
  return prisma.siteCoreSnapshot.findUnique({ where: { siteId } }) ?? null;
}
