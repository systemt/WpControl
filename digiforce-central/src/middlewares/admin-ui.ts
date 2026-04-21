import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';

export const ADMIN_COOKIE_NAME = 'dfc_admin_token';

/**
 * Soft-loads the currently signed-in user from the cookie. Never redirects —
 * just populates `req.user` and `res.locals.user` if a valid token is present.
 */
export const loadAdminUser: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
      return next();
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    res.locals.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
    next();
  }
};

/**
 * Hard gate for /admin/* pages — redirects anonymous visitors to /login.
 */
export const requireAdminUI: RequestHandler = (req, res, next) => {
  if (!req.user) {
    const target = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${target}`);
  }
  next();
};

/**
 * Gate to super-admin role inside the EJS app. Renders a simple 403 rather
 * than redirecting — a logged-in non-admin should see "access denied".
 */
export const requireAdminRoleUI: RequestHandler = (req, res, next) => {
  if (!req.user) {
    const target = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${target}`);
  }
  if (req.user.role !== 'admin') {
    res.status(403).render('pages/login', {
      title: 'Access denied',
      error: 'Administrator access required.',
      email: '',
      next: '',
    });
    return;
  }
  next();
};
