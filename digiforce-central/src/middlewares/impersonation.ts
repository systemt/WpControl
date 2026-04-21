import { RequestHandler } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export const IMPERSONATION_COOKIE_NAME = 'dfc_impersonation';
const IMPERSONATION_ISSUER = `${config.APP_NAME}-impersonation`;

declare module 'express-serve-static-core' {
  interface Request {
    originalAdmin?: { id: string; email: string; role: string };
  }
}

interface ImpersonationClaims {
  adminUserId: string;
  impersonatedUserId: string;
  iat?: number;
  exp?: number;
}

export function signImpersonationToken(adminUserId: string, impersonatedUserId: string): string {
  const payload: ImpersonationClaims = { adminUserId, impersonatedUserId };
  const options: SignOptions = {
    expiresIn: '4h',
    issuer: IMPERSONATION_ISSUER,
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function impersonationCookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 4 * 60 * 60 * 1000,
    path: '/',
  };
}

function verify(token: string): ImpersonationClaims | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { issuer: IMPERSONATION_ISSUER });
    if (typeof decoded !== 'object' || decoded === null) return null;
    const claims = decoded as ImpersonationClaims;
    if (!claims.adminUserId || !claims.impersonatedUserId) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * If an impersonation token is present AND the current session is an admin
 * matching the token's adminUserId, swap `req.user` to the impersonated user
 * while stashing the original admin on `req.originalAdmin`. Any mismatch
 * clears the cookie silently — the user just sees their own session.
 *
 * Must run after `loadAdminUser`.
 */
export const loadImpersonation: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[IMPERSONATION_COOKIE_NAME];
  if (!token) return next();

  // Only valid if the raw session is an admin.
  if (!req.user || req.user.role !== 'admin') {
    res.clearCookie(IMPERSONATION_COOKIE_NAME, { path: '/' });
    return next();
  }

  const claims = verify(token);
  if (!claims || claims.adminUserId !== req.user.id) {
    res.clearCookie(IMPERSONATION_COOKIE_NAME, { path: '/' });
    return next();
  }

  const target = await prisma.user.findUnique({ where: { id: claims.impersonatedUserId } });
  if (!target || !target.isActive) {
    res.clearCookie(IMPERSONATION_COOKIE_NAME, { path: '/' });
    return next();
  }

  req.originalAdmin = { id: req.user.id, email: req.user.email, role: req.user.role };
  req.user = { id: target.id, email: target.email, role: target.role };

  res.locals.user = {
    id: target.id,
    name: target.name,
    email: target.email,
    role: target.role,
  };
  res.locals.impersonation = {
    active: true,
    impersonatedId: target.id,
    impersonatedName: target.name,
    impersonatedEmail: target.email,
    originalAdminId: req.originalAdmin.id,
  };

  next();
};
