"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminUI = exports.loadAdminUser = exports.ADMIN_COOKIE_NAME = void 0;
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
exports.ADMIN_COOKIE_NAME = 'dfc_admin_token';
/**
 * Soft-loads the currently signed-in admin from the cookie. Never redirects —
 * just populates `req.user` and `res.locals.user` if a valid token is present.
 * Runs on every admin-UI request so the login page can detect an existing
 * session and the dashboard templates can render the user's name.
 */
const loadAdminUser = async (req, res, next) => {
    const token = req.cookies?.[exports.ADMIN_COOKIE_NAME];
    if (!token)
        return next();
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.prisma.adminUser.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive) {
            res.clearCookie(exports.ADMIN_COOKIE_NAME, { path: '/' });
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
    }
    catch {
        res.clearCookie(exports.ADMIN_COOKIE_NAME, { path: '/' });
        next();
    }
};
exports.loadAdminUser = loadAdminUser;
/**
 * Hard gate for /admin/* pages — redirects anonymous visitors to /login
 * preserving their intended destination via the `next` query parameter.
 */
const requireAdminUI = (req, res, next) => {
    if (!req.user) {
        const target = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?next=${target}`);
    }
    next();
};
exports.requireAdminUI = requireAdminUI;
//# sourceMappingURL=admin-ui.js.map