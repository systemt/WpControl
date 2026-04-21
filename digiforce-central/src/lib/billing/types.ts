import type { Plan, User } from '@prisma/client';

export interface BillingCustomer {
  id: string;
}

export interface BillingSubscriptionSnapshot {
  providerSubscriptionId: string;
  status: string;                     // active | trialing | past_due | canceled | incomplete
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface BillingProvider {
  readonly name: 'mock' | 'stripe';

  /** Ensure the user has a provider-side customer record; idempotent. */
  ensureCustomer(user: Pick<User, 'id' | 'email' | 'name'>, existingCustomerId?: string | null): Promise<BillingCustomer>;

  /** Create or update a subscription for the given customer + plan. */
  upsertSubscription(params: {
    customerId: string;
    plan: Plan;
    trialDays?: number;
    existingSubscriptionId?: string | null;
  }): Promise<BillingSubscriptionSnapshot>;

  /** Cancel immediately (no period-end grace). */
  cancelSubscription(providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot>;

  /** Fetch fresh state from the provider (used by webhook sync). */
  getSubscription(providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot>;

  /** Hosted-checkout URL used by the billing page. */
  createCheckoutSession(params: {
    customerId: string;
    plan: Plan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
}
