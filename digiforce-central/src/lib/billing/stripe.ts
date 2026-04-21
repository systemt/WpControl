import type {
  BillingCustomer,
  BillingProvider,
  BillingSubscriptionSnapshot,
  CheckoutSession,
} from './types';
import type { Plan, User } from '@prisma/client';

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
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe' as const;

  constructor(private readonly secretKey: string) {
    if (!secretKey) {
      throw new Error('StripeBillingProvider requires STRIPE_SECRET_KEY');
    }
  }

  async ensureCustomer(_user: Pick<User, 'id' | 'email' | 'name'>, _existingCustomerId?: string | null): Promise<BillingCustomer> {
    throw new Error('StripeBillingProvider.ensureCustomer not implemented — install the `stripe` SDK and wire up customers.create / .retrieve.');
  }

  async upsertSubscription(_params: {
    customerId: string;
    plan: Plan;
    trialDays?: number;
    existingSubscriptionId?: string | null;
  }): Promise<BillingSubscriptionSnapshot> {
    throw new Error('StripeBillingProvider.upsertSubscription not implemented.');
  }

  async cancelSubscription(_providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    throw new Error('StripeBillingProvider.cancelSubscription not implemented.');
  }

  async getSubscription(_providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    throw new Error('StripeBillingProvider.getSubscription not implemented.');
  }

  async createCheckoutSession(_params: {
    customerId: string;
    plan: Plan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    throw new Error('StripeBillingProvider.createCheckoutSession not implemented.');
  }
}
