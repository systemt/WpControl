"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadImpersonation = exports.IMPERSONATION_COOKIE_NAME = void 0;
exports.signImpersonationToken = signImpersonationToken;
exports.impersonationCookieOptions = impersonationCookieOptions;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
exports.IMPERSONATION_COOKIE_NAME = 'dfc_impersonation';
const IMPERSONATION_ISSUER = `${config_1.config.APP_NAME}-impersonation`;
function signImpersonationToken(adminUserId, impersonatedUserId) {
    const payload = { adminUserId, impersonatedUserId };
    const options = {
        expiresIn: '4h',
        issuer: IMPERSONATION_ISSUER,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, options);
}
function impersonationCookieOptions() {
    return {
        httpOnly: true,
        secure: config_1.config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 4 * 60 * 60 * 1000,
        path: '/',
    };
}
function verify(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET, { issuer: IMPERSONATION_ISSUER });
        if (typeof decoded !== 'object' || decoded === null)
            return null;
        const claims = decoded;
        if (!claims.adminUserId || !claims.impersonatedUserId)
            return null;
        return claims;
    }
    catch {
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
const loadImpersonation = async (req, res, next) => {
    const token = req.cookies?.[exports.IMPERSONATION_COOKIE_NAME];
    if (!token)
        return next();
    // Only valid if the raw session is an admin.
    if (!req.user || req.user.role !== 'admin') {
        res.clearCookie(exports.IMPERSONATION_COOKIE_NAME, { path: '/' });
        return next();
    }
    const claims = verify(token);
    if (!claims || claims.adminUserId !== req.user.id) {
        res.clearCookie(exports.IMPERSONATION_COOKIE_NAME, { path: '/' });
        return next();
    }
    const target = await prisma_1.prisma.user.findUnique({ where: { id: claims.impersonatedUserId } });
    if (!target || !target.isActive) {
        res.clearCookie(exports.IMPERSONATION_COOKIE_NAME, { path: '/' });
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
exports.loadImpersonation = loadImpersonation;
//# sourceMappingURL=impersonation.js.map