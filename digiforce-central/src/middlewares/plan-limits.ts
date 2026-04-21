import { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';

const ACTIVE_STATES = new Set(['active', 'trialing']);

/**
 * Before allowing a site to be provisioned, ensure the caller:
 *   • has an active or trialing subscription
 *   • hasn't already hit the plan's maxSites quota
 *
 * Admins bypass every check — they're managing tenants, not consuming them.
 */
export const requireSiteQuota: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      include: { plan: true },
    });

    if (!subscription) {
      return next(
        ApiError.forbidden(
          'No subscription found. Choose a plan from the billing page before adding sites.'
        )
      );
    }

    if (!ACTIVE_STATES.has(subscription.status)) {
      return next(
        ApiError.forbidden(
          `Subscription is ${subscription.status}. Update billing to add new sites.`
        )
      );
    }

    if (subscription.trialEndsAt && subscription.status === 'trialing' && subscription.trialEndsAt < new Date()) {
      return next(ApiError.forbidden('Trial has ended. Add a payment method to continue.'));
    }

    // null maxSites => unlimited (Agency tier).
    if (subscription.plan.maxSites !== null) {
      const count = await prisma.site.count({ where: { userId: req.user.id } });
      if (count >= subscription.plan.maxSites) {
        return next(
          ApiError.forbidden(
            `Plan limit reached: ${subscription.plan.name} allows up to ${subscription.plan.maxSites} sites. Upgrade to add more.`
          )
        );
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
