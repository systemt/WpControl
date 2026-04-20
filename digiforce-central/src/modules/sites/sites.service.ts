import { randomBytes, randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import type { CreateSiteInput, UpdateSiteInput } from './sites.schema';

function redactConnectionSecret<T extends { secretKeyEncrypted: string }>(
  connection: T | null | undefined
): (T & { secretKeyEncrypted: string }) | null {
  if (!connection) return null;
  return { ...connection, secretKeyEncrypted: '[REDACTED]' };
}

export async function listSites() {
  return prisma.site.findMany({
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

export async function getSite(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      connection: true,
      coreSnapshot: true,
      _count: { select: { pluginSnapshots: true, themeSnapshots: true } },
    },
  });
  if (!site) throw ApiError.notFound('Site not found');

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

export async function createSite(input: CreateSiteInput) {
  const uuid = input.uuid ?? randomUUID();

  const existing = await prisma.site.findUnique({ where: { uuid } });
  if (existing) throw ApiError.conflict('A site with this UUID already exists');

  const secretKey = input.secretKey ?? randomBytes(48).toString('hex');

  const site = await prisma.site.create({
    data: {
      uuid,
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

export async function updateSite(id: string, input: UpdateSiteInput) {
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Site not found');

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

export async function deleteSite(id: string) {
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Site not found');
  await prisma.site.delete({ where: { id } });
}

export async function listSitePlugins(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw ApiError.notFound('Site not found');
  return prisma.sitePluginSnapshot.findMany({
    where: { siteId },
    orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function listSiteThemes(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw ApiError.notFound('Site not found');
  return prisma.siteThemeSnapshot.findMany({
    where: { siteId },
    orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function getSiteCore(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw ApiError.notFound('Site not found');
  const core = await prisma.siteCoreSnapshot.findUnique({ where: { siteId } });
  return core ?? null;
}
