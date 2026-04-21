"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMySubscription = getMySubscription;
exports.startCheckout = startCheckout;
exports.applyPlanToUser = applyPlanToUser;
exports.cancelSubscription = cancelSubscription;
const prisma_1 = require("../../lib/prisma");
const api_error_1 = require("../../utils/api-error");
const billing_1 = require("../../lib/billing");
const config_1 = require("../../config");
async function getMySubscription(userId) {
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });
    const usage = await prisma_1.prisma.site.count({ where: { userId } });
    return { subscription, usage };
}
async function startCheckout(userId, planSlug, successUrl, cancelUrl) {
    const [user, plan, existing] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: userId } }),
        prisma_1.prisma.plan.findUnique({ where: { slug: planSlug } }),
        prisma_1.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    if (!user)
        throw api_error_1.ApiError.unauthorized();
    if (!plan || !plan.isPublic)
        throw api_error_1.ApiError.notFound('Plan not found');
    const provider = (0, billing_1.billing)();
    const customer = await provider.ensureCustomer(user, existing?.providerCustomerId ?? null);
    const session = await provider.createCheckoutSession({
        customerId: customer.id,
        plan,
        successUrl,
        cancelUrl,
    });
    // Persist the customer id so follow-up calls reuse it.
    if (!existing?.providerCustomerId) {
        if (existing) {
            await prisma_1.prisma.subscription.update({
                where: { userId },
                data: { providerCustomerId: customer.id, provider: provider.name },
            });
        }
    }
    return session;
}
/**
 * Applies a plan to the user's subscription. In mock mode this is immediate;
 * in real Stripe mode this should be driven by webhooks and this method is
 * still the single source of truth for the DB write.
 */
async function applyPlanToUser(userId, planSlug) {
    const [user, plan, existing] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: userId } }),
        prisma_1.prisma.plan.findUnique({ where: { slug: planSlug } }),
        prisma_1.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    if (!user)
        throw api_error_1.ApiError.unauthorized();
    if (!plan || !plan.isPublic)
        throw api_error_1.ApiError.notFound('Plan not found');
    const provider = (0, billing_1.billing)();
    const customer = await provider.ensureCustomer(user, existing?.providerCustomerId ?? null);
    const trialDays = !existing && plan.priceMonthly > 0 ? config_1.config.DEFAULT_TRIAL_DAYS : 0;
    const snapshot = await provider.upsertSubscription({
        customerId: customer.id,
        plan,
        trialDays,
        existingSubscriptionId: existing?.providerSubscriptionId ?? null,
    });
    return prisma_1.prisma.subscription.upsert({
        where: { userId },
        create: {
            userId,
            planId: plan.id,
            provider: provider.name,
            providerCustomerId: customer.id,
            providerSubscriptionId: snapshot.providerSubscriptionId,
            status: snapshot.status,
            currentPeriodStart: snapshot.currentPeriodStart,
            currentPeriodEnd: snapshot.currentPeriodEnd,
            trialEndsAt: snapshot.trialEndsAt,
            cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
        },
        update: {
            planId: plan.id,
            provider: provider.name,
            providerCustomerId: customer.id,
            providerSubscriptionId: snapshot.providerSubscriptionId,
            status: snapshot.status,
            currentPeriodStart: snapshot.currentPeriodStart,
            currentPeriodEnd: snapshot.currentPeriodEnd,
            trialEndsAt: snapshot.trialEndsAt,
            cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
            canceledAt: null,
        },
        include: { plan: true },
    });
}
async function cancelSubscription(userId) {
    const existing = await prisma_1.prisma.subscription.findUnique({ where: { userId } });
    if (!existing)
        throw api_error_1.ApiError.notFound('No subscription to cancel');
    const provider = (0, billing_1.billing)();
    let snapshot = { status: 'canceled', cancelAtPeriodEnd: false };
    if (existing.providerSubscriptionId) {
        const remote = await provider.cancelSubscription(existing.providerSubscriptionId);
        snapshot = { status: remote.status, cancelAtPeriodEnd: remote.cancelAtPeriodEnd };
    }
    return prisma_1.prisma.subscription.update({
        where: { userId },
        data: {
            status: snapshot.status,
            cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
            canceledAt: new Date(),
        },
        include: { plan: true },
    });
}
//# sourceMappingURL=billing.service.js.map