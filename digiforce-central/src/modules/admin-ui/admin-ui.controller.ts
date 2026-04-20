import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { config } from '../../config';
import { loginAdmin } from '../auth/auth.service';
import { ApiError } from '../../utils/api-error';
import { ADMIN_COOKIE_NAME } from '../../middlewares/admin-ui';
import { setFlash } from '../../lib/flash';
import * as sitesService from '../sites/sites.service';
import { createSiteSchema } from '../sites/sites.schema';
import {
  loadDashboard,
  listSites,
  getSiteDetail,
  listLogs,
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
  if (typeof next !== 'string') return '/admin';
  if (!next.startsWith('/') || next.startsWith('//')) return '/admin';
  return next;
}

/* ------------------------------------------------------------------------ */
/*  Auth                                                                     */
/* ------------------------------------------------------------------------ */

export const getLogin: RequestHandler = (req, res) => {
  if (req.user) {
    res.redirect('/admin');
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
    const { token } = await loginAdmin({ email, password });
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

export const postLogout: RequestHandler = (_req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  res.redirect('/login');
};

/* ------------------------------------------------------------------------ */
/*  Admin pages                                                              */
/* ------------------------------------------------------------------------ */

export const getDashboard: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await loadDashboard();
  res.render('pages/dashboard', { title: 'Dashboard', ...data });
});

export const getSitesList: RequestHandler = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const environment = typeof req.query.env === 'string' ? req.query.env : '';
  const sites = await listSites({ q, status, environment });
  res.render('pages/sites-list', {
    title: 'Sites',
    sites,
    filters: { q, status, environment },
    statusOptions: ['connected', 'disconnected', 'disabled', 'unknown'],
    envOptions: ['production', 'staging', 'development'],
  });
});

export const getSiteNew: RequestHandler = (_req, res) => {
  res.render('pages/site-new', {
    title: 'New site',
    values: { name: '', url: '', environment: 'production', centralNotes: '' },
    errors: null,
  });
};

type CreateSiteFormValues = {
  name: string;
  url: string;
  environment: string;
  centralNotes: string;
};

function readFormValues(body: unknown): CreateSiteFormValues {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    name: typeof b.name === 'string' ? b.name : '',
    url: typeof b.url === 'string' ? b.url : '',
    environment: typeof b.environment === 'string' ? b.environment : 'production',
    centralNotes: typeof b.centralNotes === 'string' ? b.centralNotes : '',
  };
}

export const postSiteCreate: RequestHandler = asyncHandler(async (req, res) => {
  const raw = readFormValues(req.body);
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

  try {
    const site = await sitesService.createSite(parsed.data);
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
  const data = await getSiteDetail(req.params.id);
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
  const data = await listLogs({ level, category, siteId });
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
