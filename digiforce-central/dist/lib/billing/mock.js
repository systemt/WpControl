"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockBillingProvider = void 0;
const crypto_1 = require("crypto");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/**
 * Zero-dependency billing provider for local dev + tests. Everything succeeds
 * immediately; subscriptions are always "active" (or "trialing" while a trial
 * is in effect). Replace with StripeBillingProvider in production.
 */
class MockBillingProvider {
    name = 'mock';
    async ensureCustomer(user, existingCustomerId) {
        return { id: existingCustomerId ?? `mock_cus_${user.id}` };
    }
    async upsertSubscription(params) {
        const subscriptionId = params.existingSubscriptionId ?? `mock_sub_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
        const now = new Date();
        const trialDays = params.trialDays ?? 0;
        const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * MS_PER_DAY) : null;
        const periodEnd = new Date(now.getTime() + 30 * MS_PER_DAY);
        return {
            providerSubscriptionId: subscriptionId,
            status: trialEndsAt ? 'trialing' : 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            trialEndsAt,
        };
    }
    async cancelSubscription(providerSubscriptionId) {
        return {
            providerSubscriptionId,
            status: 'canceled',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            trialEndsAt: null,
        };
    }
    async getSubscription(providerSubscriptionId) {
        const now = new Date();
        return {
            providerSubscriptionId,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * MS_PER_DAY),
            cancelAtPeriodEnd: false,
            trialEndsAt: null,
        };
    }
    async createCheckoutSession(params) {
        // The "checkout URL" in mock mode lands back on our billing page with a
        // flag so the controller can finalize the subscription immediately.
        const sessionId = `mock_cs_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
        const url = `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}mockCheckout=1&plan=${encodeURIComponent(params.plan.slug)}&session=${sessionId}`;
        return { url, sessionId };
    }
}
exports.MockBillingProvider = MockBillingProvider;
//# sourceMappingURL=mock.js.map