import { randomBytes } from 'crypto';
import type {
  BillingCustomer,
  BillingProvider,
  BillingSubscriptionSnapshot,
  CheckoutSession,
} from './types';
import type { Plan, User } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Zero-dependency billing provider for local dev + tests. Everything succeeds
 * immediately; subscriptions are always "active" (or "trialing" while a trial
 * is in effect). Replace with StripeBillingProvider in production.
 */
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock' as const;

  async ensureCustomer(
    user: Pick<User, 'id' | 'email' | 'name'>,
    existingCustomerId?: string | null
  ): Promise<BillingCustomer> {
    return { id: existingCustomerId ?? `mock_cus_${user.id}` };
  }

  async upsertSubscription(params: {
    customerId: string;
    plan: Plan;
    trialDays?: number;
    existingSubscriptionId?: string | null;
  }): Promise<BillingSubscriptionSnapshot> {
    const subscriptionId =
      params.existingSubscriptionId ?? `mock_sub_${randomBytes(8).toString('hex')}`;
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

  async cancelSubscription(providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    return {
      providerSubscriptionId,
      status: 'canceled',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    };
  }

  async getSubscription(providerSubscriptionId: string): Promise<BillingSubscriptionSnapshot> {
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

  async createCheckoutSession(params: {
    customerId: string;
    plan: Plan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    // The "checkout URL" in mock mode lands back on our billing page with a
    // flag so the controller can finalize the subscription immediately.
    const sessionId = `mock_cs_${randomBytes(8).toString('hex')}`;
    const url = `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}mockCheckout=1&plan=${encodeURIComponent(params.plan.slug)}&session=${sessionId}`;
    return { url, sessionId };
  }
}
