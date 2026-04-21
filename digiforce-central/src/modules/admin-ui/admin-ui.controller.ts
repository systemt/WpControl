import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { config } from '../../config';
import { loginUser, signupUser } from '../auth/auth.service';
import { ApiError } from '../../utils/api-error';
import { ADMIN_COOKIE_NAME } from '../../middlewares/admin-ui';
import { setFlash } from '../../lib/flash';
import * as sitesService from '../sites/sites.service';
import { createSiteSchema } from '../sites/sites.schema';
import { prisma } from '../../lib/prisma';
import { applyPlanToUser, cancelSubscription, getMySubscription } from '../billing/billing.service';
import { enqueueCommand, retryCommand } from '../commands/commands.service';
import { dispatchSchema } from '../commands/commands.schema';
import {
  IMPERSONATION_COOKIE_NAME,
  impersonationCookieOptions,
  signImpersonationToken,
} from '../../middlewares/impersonation';
import {
  loadDashboard,
  listSites,
  getSiteDetail,
  listLogs,
  listAllUsers,
} from './admin-ui.service';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: TWELVE_HOURS_MS,
    path: '/',
  };
}

function safeNext(next: unknown): string {
  if (typeof next !== 'string') return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

function actorFromReq(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

/* ------------------------------------------------------------------------ */
/*  Auth pages                                                               */
/* ------------------------------------------------------------------------ */

export const getLogin: RequestHandler = (req, res) => {
  if (req.user) {
    res.redirect('/dashboard');
    return;
  }
  res.render('pages/login', {
    title: 'Sign in',
    error: null,
    email: '',
    next: typeof req.query.next === 'string' ? req.query.next : '',
  });
};

export const postLogin: RequestHandler = asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  const next = safeNext(req.body.next);

  if (!email || !password) {
    res.status(400).render('pages/login', {
      title: 'Sign in',
      error: 'Email and password are required.',
      email,
      next,
    });
    return;
  }

  try {
    const { token } = await loginUser({ email, password });
    res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions());
    res.redirect(next);
  } catch (err) {
    const message =
      err instanceof ApiError && err.status !== 500 ? err.message : 'Invalid email or password.';
    res.status(401).render('pages/login', {
      title: 'Sign in',
      error: message,
      email,
      next,
    });
  }
});

export const getSignup: RequestHandler = (req, res) => {
  if (req.user) {
    res.redirect('/dashboard');
    return;
  }
  res.render('pages/signup', {
    title: 'Create account',
    values: { name: '', email: '' },
    error: null,
  });
};

export const postSignup: RequestHandler = asyncHandler(async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!name || !email || password.length < 8) {
    res.status(400).render('pages/signup', {
      title: 'Create account',
      values: { name, email },
      error: 'Enter a name, a valid email, and a password of at least 8 characters.',
    });
    return;
  }

  try {
    const { token } = await signupUser({ name, email, password });
    res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions());
    setFlash(res, { type: 'success', message: 'Account created — you have a trial on the Starter plan.' });
    res.redirect('/dashboard');
  } catch (err) {
    const message =
      err instanceof ApiError && err.status !== 500 ? err.message : 'Could not create account.';
    res.status(400).render('pages/signup', {
      title: 'Create account',
      values: { name, email },
      error: message,
    });
  }
});

export const postLogout: RequestHandler = (_req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  res.redirect('/login');
};

/* ------------------------------------------------------------------------ */
/*  Dashboard / sites / logs                                                 */
/* ------------------------------------------------------------------------ */

export const getDashboard: RequestHandler = asyncHandler(async (req, res) => {
  const data = await loadDashboard(actorFromReq(req));
  res.render('pages/dashboard', { title: 'Dashboard', ...data });
});

export const getSitesList: RequestHandler = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const environment = typeof req.query.env === 'string' ? req.query.env : '';
  const sites = await listSites(actorFromReq(req), { q, status, environment });

  // Surface quota so the UI can disable "New site" when the user is at cap.
  let quota: { used: number; max: number | null; planName: string } | null = null;
  if (req.user && req.user.role !== 'admin') {
    const sub = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      include: { plan: true },
    });
    if (sub) {
      const used = await prisma.site.count({ where: { userId: req.user.id } });
      quota = { used, max: sub.plan.maxSites, planName: sub.plan.name };
    }
  }

  res.render('pages/sites-list', {
    title: 'Sites',
    sites,
    filters: { q, status, environment },
    statusOptions: ['connected', 'disconnected', 'disabled', 'unknown'],
    envOptions: ['production', 'staging', 'development'],
    quota,
  });
});

export const getSiteNew: RequestHandler = (_req, res) => {
  res.render('pages/site-new', {
    title: 'New site',
    values: { name: '', url: '', environment: 'production', centralNotes: '' },
    errors: null,
  });
};

export const postSiteCreate: RequestHandler = asyncHandler(async (req, res) => {
  const actor = actorFromReq(req);
  const raw = {
    name: typeof req.body.name === 'string' ? req.body.name : '',
    url: typeof req.body.url === 'string' ? req.body.url : '',
    environment: typeof req.body.environment === 'string' ? req.body.environment : 'production',
    centralNotes: typeof req.body.centralNotes === 'string' ? req.body.centralNotes : '',
  };

  const input: Record<string, unknown> = {
    name: raw.name.trim(),
    url: raw.url.trim(),
    environment: raw.environment,
  };
  const notes = raw.centralNotes.trim();
  if (notes) input.centralNotes = notes;

  const parsed = createSiteSchema.safeParse(input);
  if (!parsed.success) {
    res.status(400).render('pages/site-new', {
      title: 'New site',
      values: raw,
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  // Plan-quota enforcement at the UI boundary (API layer uses middleware).
  if (actor.role !== 'admin') {
    const sub = await prisma.subscription.findUnique({
      where: { userId: actor.id },
      include: { plan: true },
    });
    if (!sub) {
      res.status(403).render('pages/site-new', {
        title: 'New site',
        values: raw,
        errors: { _form: ['You need an active subscription to add sites. Visit Billing.'] },
      });
      return;
    }
    if (!['active', 'trialing'].includes(sub.status)) {
      res.status(403).render('pages/site-new', {
        title: 'New site',
        values: raw,
        errors: { _form: [`Subscription is ${sub.status}. Update billing to add new sites.`] },
      });
      return;
    }
    if (sub.plan.maxSites !== null) {
      const count = await prisma.site.count({ where: { userId: actor.id } });
      if (count >= sub.plan.maxSites) {
        res.status(403).render('pages/site-new', {
          title: 'New site',
          values: raw,
          errors: {
            _form: [`Plan limit reached: ${sub.plan.name} allows up to ${sub.plan.maxSites} sites. Upgrade on the Billing page.`],
          },
        });
        return;
      }
    }
  }

  try {
    const site = await sitesService.createSite(actor, parsed.data);
    setFlash(res, {
      type: 'success',
      message: 'Site created. Save the secret key below — it will not be shown again.',
      data: { secretKey: site.secretKey, siteUuid: site.uuid },
    });
    res.redirect(`/admin/sites/${site.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      res.status(409).render('pages/site-new', {
        title: 'New site',
        values: raw,
        errors: { _form: [err.message] },
      });
      return;
    }
    throw err;
  }
});

export const getSiteDetailPage: RequestHandler = asyncHandler(async (req, res) => {
  const data = await getSiteDetail(actorFromReq(req), req.params.id);
  res.render('pages/site-detail', {
    title: data.site.name,
    site: data.site,
    plugins: data.plugins,
    themes: data.themes,
    core: data.core,
    logs: data.logs,
    commands: data.commands,
    recentlySeen: data.recentlySeen,
  });
});

export const getLogsPage: RequestHandler = asyncHandler(async (req, res) => {
  const level = typeof req.query.level === 'string' ? req.query.level : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : '';
  const data = await listLogs(actorFromReq(req), { level, category, siteId });
  res.render('pages/logs', {
    title: 'Logs',
    logs: data.logs,
    sites: data.sites,
    filters: { level, category, siteId },
    levels: ['info', 'warning', 'error'],
    categories: [
      'security',
      'sync',
      'scan',
      'command',
      'update',
      'system',
      'agent',
      'heartbeat',
      'register',
    ],
  });
});

/* ------------------------------------------------------------------------ */
/*  Billing / account                                                        */
/* ------------------------------------------------------------------------ */

export const getBillingPage: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const [plans, { subscription, usage }] = await Promise.all([
    prisma.plan.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' } }),
    getMySubscription(req.user.id),
  ]);
  res.render('pages/billing', {
    title: 'Billing',
    plans,
    subscription,
    usage,
  });
});

export const postBillingChangePlan: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const planSlug = String(req.body.plan ?? '').trim();
  if (!planSlug) {
    setFlash(res, { type: 'error', message: 'Choose a plan first.' });
    res.redirect('/billing');
    return;
  }
  try {
    await applyPlanToUser(req.user.id, planSlug);
    setFlash(res, { type: 'success', message: 'Subscription updated.' });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Could not change plan.';
    setFlash(res, { type: 'error', message: msg });
  }
  res.redirect('/billing');
});

export const postBillingCancel: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  try {
    await cancelSubscription(req.user.id);
    setFlash(res, { type: 'warn', message: 'Subscription cancelled. Existing sites remain visible but new sites cannot be added.' });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Could not cancel subscription.';
    setFlash(res, { type: 'error', message: msg });
  }
  res.redirect('/billing');
});

export const getAccountPage: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true },
  });
  res.render('pages/account', {
    title: 'Account',
    account: user,
  });
});

/* ------------------------------------------------------------------------ */
/*  Command dispatch (admin-UI form posts)                                   */
/* ------------------------------------------------------------------------ */

/**
 * Handle the HTML form submissions on the site-detail page for sync_status,
 * scan_updates, update_plugin, activate_plugin, deactivate_plugin, and the
 * two auto-update toggles. All failures land as a flash — we never 500 the
 * browser on a bad agent response.
 */
export const postDispatchCommand: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const siteId = req.params.id;
  const redirectBack = `/admin/sites/${encodeURIComponent(siteId)}`;

  const action = typeof req.body.action === 'string' ? req.body.action : '';

  // Build the action-specific payload from the form fields that are present.
  const payload: Record<string, unknown> = {};
  if (typeof req.body.plugin_file === 'string' && req.body.plugin_file.trim()) {
    payload.plugin_file = req.body.plugin_file.trim();
  }
  if (Array.isArray(req.body.plugin_files)) {
    payload.plugin_files = req.body.plugin_files.filter(
      (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
    );
  }

  const parsed = dispatchSchema.safeParse({ action, payload });
  if (!parsed.success) {
    setFlash(res, { type: 'error', message: 'Invalid command.' });
    res.redirect(redirectBack);
    return;
  }

  try {
    await enqueueCommand(
      { id: req.user.id, role: req.user.role },
      siteId,
      parsed.data
    );
    setFlash(res, {
      type: 'success',
      message: `Command ${parsed.data.action} queued. The status will update in the commands table shortly.`,
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Command dispatch failed.';
    setFlash(res, { type: 'error', message: msg });
  }

  res.redirect(redirectBack);
});

/**
 * Re-queue a failed command. Only `status='failed'` rows are retryable. Each
 * retry creates a NEW SiteCommand row (attempt++), linked to the original via
 * `parentCommandId`, so the audit trail is preserved.
 */
export const postRetryCommand: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const siteId = req.params.id;
  const commandRowId = req.params.commandId;
  const redirectBack = `/admin/sites/${encodeURIComponent(siteId)}`;

  try {
    const retry = await retryCommand(
      { id: req.user.id, role: req.user.role },
      siteId,
      commandRowId
    );
    setFlash(res, {
      type: 'success',
      message: `Retry queued for ${retry.action} (attempt ${retry.attempt}).`,
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Retry failed.';
    setFlash(res, { type: 'error', message: msg });
  }

  res.redirect(redirectBack);
});

/* ------------------------------------------------------------------------ */
/*  Admin-only: users list + impersonation                                   */
/* ------------------------------------------------------------------------ */

export const getAdminUsersPage: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const users = await listAllUsers();
  res.render('pages/admin-users', {
    title: 'Users',
    users,
    currentUserId: req.user.id,
  });
});

/**
 * Start impersonating another user. Requires a REAL admin session — impersonated
 * admins (if we ever allow that) would appear as role='user' here and fail the
 * role check in the route layer.
 */
export const postImpersonate: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();

  // Guard against nesting — if `req.originalAdmin` is set, the middleware
  // already swapped us, meaning this admin is currently impersonating someone
  // else. Require them to stop first.
  if (req.originalAdmin) {
    setFlash(res, { type: 'error', message: 'Stop the current impersonation before starting a new one.' });
    res.redirect('/admin/users');
    return;
  }

  const targetId = req.params.id;
  if (!targetId) {
    setFlash(res, { type: 'error', message: 'Missing user id.' });
    res.redirect('/admin/users');
    return;
  }
  if (targetId === req.user.id) {
    setFlash(res, { type: 'error', message: 'You cannot impersonate yourself.' });
    res.redirect('/admin/users');
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || !target.isActive) {
    setFlash(res, { type: 'error', message: 'User not found or inactive.' });
    res.redirect('/admin/users');
    return;
  }
  if (target.role === 'admin') {
    setFlash(res, { type: 'error', message: 'Cannot impersonate another administrator.' });
    res.redirect('/admin/users');
    return;
  }

  const token = signImpersonationToken(req.user.id, target.id);
  res.cookie(IMPERSONATION_COOKIE_NAME, token, impersonationCookieOptions());

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user.id,
      targetUserId: target.id,
      action: 'impersonation_start',
      meta: {
        targetEmail: target.email,
        targetName: target.name,
        adminEmail: req.user.email,
      },
    },
  });

  setFlash(res, {
    type: 'warn',
    message: `You are now impersonating ${target.name} (${target.email}).`,
  });
  res.redirect('/dashboard');
});

/**
 * Stop impersonating. Runs under `requireAdminUI` only — not the role gate —
 * because during impersonation the user appears as the impersonated user.
 * Clears the cookie regardless of state, and audits when the middleware saw
 * an active impersonation (`req.originalAdmin`).
 */
export const postStopImpersonation: RequestHandler = asyncHandler(async (req, res) => {
  // `loadImpersonation` populates `req.originalAdmin` + `res.locals.impersonation`.
  const locals = res.locals as { impersonation?: { impersonatedId?: string; impersonatedEmail?: string } };
  const impersonated = locals.impersonation;

  res.clearCookie(IMPERSONATION_COOKIE_NAME, { path: '/' });

  if (req.originalAdmin && impersonated?.impersonatedId) {
    await prisma.auditLog.create({
      data: {
        actorUserId: req.originalAdmin.id,
        targetUserId: impersonated.impersonatedId,
        action: 'impersonation_stop',
        meta: {
          targetEmail: impersonated.impersonatedEmail ?? null,
          adminEmail: req.originalAdmin.email,
        },
      },
    });
  }

  setFlash(res, { type: 'info', message: 'Stopped impersonation.' });
  res.redirect('/admin/users');
});
