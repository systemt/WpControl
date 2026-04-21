import { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error';

/**
 * Gate a route to super-admin users only. Assumes `requireAuth` (API) or
 * `loadAdminUser` + `requireAdminUI` (EJS) ran earlier and populated req.user.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden('Admin access required'));
  next();
};
