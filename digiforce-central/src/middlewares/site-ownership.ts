import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import type { Site } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    site?: Site;
  }
}

/**
 * Load the site named by `:id` and attach to `req.site`. Enforces per-tenant
 * isolation — a `user` role can only touch their own sites, admins bypass.
 */
export const requireSiteOwnership: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next(ApiError.unauthorized());
    const siteId = req.params.id;
    if (!siteId) return next(ApiError.badRequest('Missing site id'));

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return next(ApiError.notFound('Site not found'));

    if (req.user.role !== 'admin' && site.userId !== req.user.id) {
      // Return 404 rather than 403 so a user can't probe which ids exist.
      return next(ApiError.notFound('Site not found'));
    }

    req.site = site;
    next();
  } catch (err) {
    next(err);
  }
};
