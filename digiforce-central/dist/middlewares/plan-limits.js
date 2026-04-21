"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSiteQuota = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const ACTIVE_STATES = new Set(['active', 'trialing']);
/**
 * Before allowing a site to be provisioned, ensure the caller:
 *   • has an active or trialing subscription
 *   • hasn't already hit the plan's maxSites quota
 *
 * Admins bypass every check — they're managing tenants, not consuming them.
 */
const requireSiteQuota = async (req, _res, next) => {
    try {
        if (!req.user)
            return next(api_error_1.ApiError.unauthorized());
        if (req.user.role === 'admin')
            return next();
        const subscription = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
            include: { plan: true },
        });
        if (!subscription) {
            return next(api_error_1.ApiError.forbidden('No subscription found. Choose a plan from the billing page before adding sites.'));
        }
        if (!ACTIVE_STATES.has(subscription.status)) {
            return next(api_error_1.ApiError.forbidden(`Subscription is ${subscription.status}. Update billing to add new sites.`));
        }
        if (subscription.trialEndsAt && subscription.status === 'trialing' && subscription.trialEndsAt < new Date()) {
            return next(api_error_1.ApiError.forbidden('Trial has ended. Add a payment method to continue.'));
        }
        // null maxSites => unlimited (Agency tier).
        if (subscription.plan.maxSites !== null) {
            const count = await prisma_1.prisma.site.count({ where: { userId: req.user.id } });
            if (count >= subscription.plan.maxSites) {
                return next(api_error_1.ApiError.forbidden(`Plan limit reached: ${subscription.plan.name} allows up to ${subscription.plan.maxSites} sites. Upgrade to add more.`));
            }
        }
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireSiteQuota = requireSiteQuota;
//# sourceMappingURL=plan-limits.js.map