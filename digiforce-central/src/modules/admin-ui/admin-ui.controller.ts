import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { config } from '../../config';
import { loginAdmin } from '../auth/auth.service';
import { ApiError } from '../../utils/api-error';
import { ADMIN_COOKIE_NAME } from '../../middlewares/admin-ui';
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
  // Only accept same-origin, absolute paths to avoid open-redirect abuse.
  if (!next.startsWith('/') || next.startsWith('//')) return '/admin';
  return next;
}

/* ------------------------------------------------------------------------ */
/*  Auth pages                                                               */
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
  const sites = await listSites({ q, status });
  res.render('pages/sites-list', {
    title: 'Sites',
    sites,
    filters: { q, status },
    statusOptions: ['connected', 'disconnected', 'disabled', 'unknown'],
  });
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
