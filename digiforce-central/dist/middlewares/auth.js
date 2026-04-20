"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
const api_error_1 = require("../utils/api-error");
const requireAuth = async (req, _res, next) => {
    try {
        const header = req.header('authorization');
        if (!header || !header.toLowerCase().startsWith('bearer ')) {
            return next(api_error_1.ApiError.unauthorized('Missing or invalid Authorization header'));
        }
        const token = header.slice(7).trim();
        if (!token)
            return next(api_error_1.ApiError.unauthorized('Empty bearer token'));
        let payload;
        try {
            payload = (0, jwt_1.verifyToken)(token);
        }
        catch {
            return next(api_error_1.ApiError.unauthorized('Invalid or expired token'));
        }
        const user = await prisma_1.prisma.adminUser.findUnique({ where: { id: payload.sub } });
        if (!user)
            return next(api_error_1.ApiError.unauthorized('User not found'));
        if (!user.isActive)
            return next(api_error_1.ApiError.forbidden('User is not active'));
        req.user = { id: user.id, email: user.email, role: user.role };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireAuth = requireAuth;
//# sourceMappingURL=auth.js.map