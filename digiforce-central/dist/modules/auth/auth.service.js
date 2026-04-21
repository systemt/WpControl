"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAdmin = loginAdmin;
exports.loginUser = loginUser;
exports.signupUser = signupUser;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../lib/prisma");
const jwt_1 = require("../../lib/jwt");
const api_error_1 = require("../../utils/api-error");
const sanitize_1 = require("../../utils/sanitize");
const config_1 = require("../../config");
/**
 * Legacy export name kept for any callers that still reference it — now
 * validates against the unified `users` table.
 */
async function loginAdmin(input) {
    return loginUser(input);
}
async function loginUser(input) {
    const user = await prisma_1.prisma.user.findUnique({ where: { email: input.email } });
    if (!user)
        throw api_error_1.ApiError.unauthorized('Invalid credentials');
    if (!user.isActive)
        throw api_error_1.ApiError.forbidden('User is not active');
    const match = await bcryptjs_1.default.compare(input.password, user.passwordHash);
    if (!match)
        throw api_error_1.ApiError.unauthorized('Invalid credentials');
    const updated = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    const token = (0, jwt_1.signToken)({ sub: updated.id, email: updated.email, role: updated.role });
    return { token, user: (0, sanitize_1.sanitizeUser)(updated) };
}
/**
 * Creates a new tenant user + a trial Subscription on the default plan so the
 * user can add sites immediately. No billing provider is touched here — the
 * billing module is responsible for any paid upgrades.
 */
async function signupUser(input) {
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: input.email } });
    if (existing)
        throw api_error_1.ApiError.conflict('An account with this email already exists');
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    const user = await prisma_1.prisma.user.create({
        data: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'user',
            isActive: true,
        },
    });
    // Attach a trial subscription to the configured default plan if present.
    const defaultPlan = await prisma_1.prisma.plan.findUnique({
        where: { slug: config_1.config.DEFAULT_TRIAL_PLAN_SLUG },
    });
    if (defaultPlan) {
        const trialEndsAt = config_1.config.DEFAULT_TRIAL_DAYS > 0
            ? new Date(Date.now() + config_1.config.DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000)
            : null;
        await prisma_1.prisma.subscription.create({
            data: {
                userId: user.id,
                planId: defaultPlan.id,
                status: trialEndsAt ? 'trialing' : 'active',
                provider: config_1.config.BILLING_PROVIDER,
                trialEndsAt,
                currentPeriodStart: new Date(),
                currentPeriodEnd: trialEndsAt,
            },
        });
    }
    const token = (0, jwt_1.signToken)({ sub: user.id, email: user.email, role: user.role });
    return { token, user: (0, sanitize_1.sanitizeUser)(user) };
}
async function getMe(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw api_error_1.ApiError.notFound('User not found');
    return (0, sanitize_1.sanitizeUser)(user);
}
//# sourceMappingURL=auth.service.js.map