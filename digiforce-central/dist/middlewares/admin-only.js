"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const api_error_1 = require("../utils/api-error");
/**
 * Gate a route to super-admin users only. Assumes `requireAuth` (API) or
 * `loadAdminUser` + `requireAdminUI` (EJS) ran earlier and populated req.user.
 */
const requireAdmin = (req, _res, next) => {
    if (!req.user)
        return next(api_error_1.ApiError.unauthorized());
    if (req.user.role !== 'admin')
        return next(api_error_1.ApiError.forbidden('Admin access required'));
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=admin-only.js.map