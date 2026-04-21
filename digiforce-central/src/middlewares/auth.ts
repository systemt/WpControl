import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';
import { ApiError } from '../utils/api-error';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}

/**
 * Bearer-token auth for the JSON API. Resolves a User row and rejects
 * inactive / missing users.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      return next(ApiError.unauthorized('Missing or invalid Authorization header'));
    }
    const token = header.slice(7).trim();
    if (!token) return next(ApiError.unauthorized('Empty bearer token'));

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next(ApiError.unauthorized('Invalid or expired token'));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return next(ApiError.unauthorized('User not found'));
    if (!user.isActive) return next(ApiError.forbidden('User is not active'));

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};
