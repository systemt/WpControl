"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSiteOwnership = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
/**
 * Load the site named by `:id` and attach to `req.site`. Enforces per-tenant
 * isolation — a `user` role can only touch their own sites, admins bypass.
 */
const requireSiteOwnership = async (req, _res, next) => {
    try {
        if (!req.user)
            return next(api_error_1.ApiError.unauthorized());
        const siteId = req.params.id;
        if (!siteId)
            return next(api_error_1.ApiError.badRequest('Missing site id'));
        const site = await prisma_1.prisma.site.findUnique({ where: { id: siteId } });
        if (!site)
            return next(api_error_1.ApiError.notFound('Site not found'));
        if (req.user.role !== 'admin' && site.userId !== req.user.id) {
            // Return 404 rather than 403 so a user can't probe which ids exist.
            return next(api_error_1.ApiError.notFound('Site not found'));
        }
        req.site = site;
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireSiteOwnership = requireSiteOwnership;
//# sourceMappingURL=site-ownership.js.map