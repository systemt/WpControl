import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getSummary } from '../dashboard/dashboard.service';
import * as sitesService from '../sites/sites.service';

export async function loadDashboard() {
  const [summary, recentSites, recentLogs] = await Promise.all([
    getSummary(),
    prisma.site.findMany({
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
    prisma.siteLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { site: { select: { id: true, name: true } } },
    }),
  ]);
  return { summary, recentSites, recentLogs };
}

export async function listSites(filters: { q?: string; status?: string }) {
  const where: Prisma.SiteWhereInput = {};
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

  return prisma.site.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      connection: { select: { connectionEnabled: true, requireSignedRequests: true } },
    },
  });
}

export async function getSiteDetail(id: string) {
  const site = await sitesService.getSite(id);
  const [plugins, themes, core, logs] = await Promise.all([
    prisma.sitePluginSnapshot.findMany({
      where: { siteId: id },
      orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
      take: 200,
    }),
    prisma.siteThemeSnapshot.findMany({
      where: { siteId: id },
      orderBy: [{ hasUpdate: 'desc' }, { isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.siteCoreSnapshot.findUnique({ where: { siteId: id } }),
    prisma.siteLog.findMany({
      where: { siteId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);
  return { site, plugins, themes, core, logs };
}

export async function listLogs(filters: { level?: string; category?: string; siteId?: string }) {
  const where: Prisma.SiteLogWhereInput = {};
  if (filters.level) where.level = filters.level;
  if (filters.category) where.category = filters.category;
  if (filters.siteId) where.siteId = filters.siteId;

  const [logs, sites] = await Promise.all([
    prisma.siteLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { site: { select: { id: true, name: true } } },
    }),
    prisma.site.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { logs, sites };
}
