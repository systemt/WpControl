import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import * as sitesService from '../sites/sites.service';

const RECENTLY_SEEN_MS = 15 * 60 * 1000;

export interface ViewActor {
  id: string;
  role: string;
}

function scopeSites(actor: ViewActor, where: Prisma.SiteWhereInput = {}): Prisma.SiteWhereInput {
  if (actor.role === 'admin') return where;
  return { ...where, userId: actor.id };
}

function scopeLogs(actor: ViewActor, where: Prisma.SiteLogWhereInput = {}): Prisma.SiteLogWhereInput {
  if (actor.role === 'admin') return where;
  return { ...where, site: { userId: actor.id } };
}

export async function loadDashboard(actor: ViewActor) {
  const siteWhere = scopeSites(actor);
  const logWhere = scopeLogs(actor);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalSites,
    connectedSites,
    inactiveSites,
    sitesWithUpdates,
    totalCommands,
    failedCommands,
    recentLogsCount,
    recentSites,
    recentLogs,
    subscription,
  ] = await Promise.all([
    prisma.site.count({ where: siteWhere }),
    prisma.site.count({ where: { ...siteWhere, status: 'connected' } }),
    prisma.site.count({ where: { ...siteWhere, status: { in: ['disconnected', 'disabled', 'unknown'] } } }),
    prisma.site.count({
      where: {
        ...siteWhere,
        OR: [
          { pluginSnapshots: { some: { hasUpdate: true } } },
          { themeSnapshots: { some: { hasUpdate: true } } },
          { coreSnapshot: { hasUpdate: true } },
        ],
      },
    }),
    prisma.siteCommand.count({ where: { site: siteWhere } }),
    prisma.siteCommand.count({ where: { site: siteWhere, status: 'failed' } }),
    prisma.siteLog.count({ where: { ...logWhere, createdAt: { gte: since } } }),
    prisma.site.findMany({
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
    prisma.siteLog.findMany({
      where: logWhere,
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { site: { select: { id: true, name: true } } },
    }),
    actor.role === 'admin'
      ? null
      : prisma.subscription.findUnique({
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

export async function listSites(actor: ViewActor, filters: { q?: string; status?: string; environment?: string }) {
  const where: Prisma.SiteWhereInput = scopeSites(actor);
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { url: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.environment) where.environment = filters.environment;

  return prisma.site.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      connection: { select: { connectionEnabled: true, requireSignedRequests: true } },
    },
  });
}

export async function getSiteDetail(actor: ViewActor, id: string) {
  const site = await sitesService.getSite({ id: actor.id, role: actor.role }, id);
  const [plugins, themes, core, logs, commands] = await Promise.all([
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
    prisma.siteCommand.findMany({
      where: { siteId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const recentlySeen = Boolean(
    site.lastSeenAt && Date.now() - new Date(site.lastSeenAt as Date).getTime() < RECENTLY_SEEN_MS
  );

  return { site, plugins, themes, core, logs, commands, recentlySeen };
}

export async function listLogs(actor: ViewActor, filters: { level?: string; category?: string; siteId?: string }) {
  const where: Prisma.SiteLogWhereInput = scopeLogs(actor);
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
export async function listAllUsers() {
  const users = await prisma.user.findMany({
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
