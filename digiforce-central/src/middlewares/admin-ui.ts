import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';

export const ADMIN_COOKIE_NAME = 'dfc_admin_token';

/**
 * Soft-loads the currently signed-in admin from the cookie. Never redirects —
 * just populates `req.user` and `res.locals.user` if a valid token is present.
 * Runs on every admin-UI request so the login page can detect an existing
 * session and the dashboard templates can render the user's name.
 */
export const loadAdminUser: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
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
 * Hard gate for /admin/* pages — redirects anonymous visitors to /login
 * preserving their intended destination via the `next` query parameter.
 */
export const requireAdminUI: RequestHandler = (req, res, next) => {
  if (!req.user) {
    const target = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${target}`);
  }
  next();
};
