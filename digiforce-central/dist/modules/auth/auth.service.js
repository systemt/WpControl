"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAdmin = loginAdmin;
exports.getMe = getMe;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../lib/prisma");
const jwt_1 = require("../../lib/jwt");
const api_error_1 = require("../../utils/api-error");
const sanitize_1 = require("../../utils/sanitize");
async function loginAdmin(input) {
    const user = await prisma_1.prisma.adminUser.findUnique({ where: { email: input.email } });
    if (!user)
        throw api_error_1.ApiError.unauthorized('Invalid credentials');
    if (!user.isActive)
        throw api_error_1.ApiError.forbidden('User is not active');
    const match = await bcrypt_1.default.compare(input.password, user.passwordHash);
    if (!match)
        throw api_error_1.ApiError.unauthorized('Invalid credentials');
    const updated = await prisma_1.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    const token = (0, jwt_1.signToken)({ sub: updated.id, email: updated.email, role: updated.role });
    return { token, user: (0, sanitize_1.sanitizeAdminUser)(updated) };
}
async function getMe(userId) {
    const user = await prisma_1.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user)
        throw api_error_1.ApiError.notFound('User not found');
    return (0, sanitize_1.sanitizeAdminUser)(user);
}
//# sourceMappingURL=auth.service.js.map