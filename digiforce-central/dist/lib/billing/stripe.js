"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeBillingProvider = void 0;
/**
 * Stripe provider stub.
 *
 * This file intentionally does NOT import the `stripe` SDK — step 1 of the SaaS
 * migration ships with the mock provider so you can boot without `stripe`
 * installed. When you're ready to flip the switch:
 *
 *   1. `npm install stripe`
 *   2. Set `BILLING_PROVIDER=stripe` + `STRIPE_SECRET_KEY` in the environment.
 *   3. Replace the bodies below with the real Stripe SDK calls. The surface is
 *      already defined by `BillingProvider` so no controller needs to change.
 *
 * Every method throws today so a misconfigured deploy fails fast instead of
 * silently no-op-ing payments.
 */
class StripeBillingProvider {
    secretKey;
    name = 'stripe';
    constructor(secretKey) {
        this.secretKey = secretKey;
        if (!secretKey) {
            throw new Error('StripeBillingProvider requires STRIPE_SECRET_KEY');
        }
    }
    async ensureCustomer(_user, _existingCustomerId) {
        throw new Error('StripeBillingProvider.ensureCustomer not implemented — install the `stripe` SDK and wire up customers.create / .retrieve.');
    }
    async upsertSubscription(_params) {
        throw new Error('StripeBillingProvider.upsertSubscription not implemented.');
    }
    async cancelSubscription(_providerSubscriptionId) {
        throw new Error('StripeBillingProvider.cancelSubscription not implemented.');
    }
    async getSubscription(_providerSubscriptionId) {
        throw new Error('StripeBillingProvider.getSubscription not implemented.');
    }
    async createCheckoutSession(_params) {
        throw new Error('StripeBillingProvider.createCheckoutSession not implemented.');
    }
}
exports.StripeBillingProvider = StripeBillingProvider;
//# sourceMappingURL=stripe.js.map