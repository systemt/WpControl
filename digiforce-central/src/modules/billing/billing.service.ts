import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { billing } from '../../lib/billing';
import { config } from '../../config';

export async function getMySubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  const usage = await prisma.site.count({ where: { userId } });
  return { subscription, usage };
}

export async function startCheckout(userId: string, planSlug: string, successUrl: string, cancelUrl: string) {
  const [user, plan, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.plan.findUnique({ where: { slug: planSlug } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  if (!user) throw ApiError.unauthorized();
  if (!plan || !plan.isPublic) throw ApiError.notFound('Plan not found');

  const provider = billing();
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
      await prisma.subscription.update({
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
export async function applyPlanToUser(userId: string, planSlug: string) {
  const [user, plan, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.plan.findUnique({ where: { slug: planSlug } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);
  if (!user) throw ApiError.unauthorized();
  if (!plan || !plan.isPublic) throw ApiError.notFound('Plan not found');

  const provider = billing();
  const customer = await provider.ensureCustomer(user, existing?.providerCustomerId ?? null);

  const trialDays =
    !existing && plan.priceMonthly > 0 ? config.DEFAULT_TRIAL_DAYS : 0;

  const snapshot = await provider.upsertSubscription({
    customerId: customer.id,
    plan,
    trialDays,
    existingSubscriptionId: existing?.providerSubscriptionId ?? null,
  });

  return prisma.subscription.upsert({
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

export async function cancelSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) throw ApiError.notFound('No subscription to cancel');

  const provider = billing();
  let snapshot = { status: 'canceled', cancelAtPeriodEnd: false };
  if (existing.providerSubscriptionId) {
    const remote = await provider.cancelSubscription(existing.providerSubscriptionId);
    snapshot = { status: remote.status, cancelAtPeriodEnd: remote.cancelAtPeriodEnd };
  }

  return prisma.subscription.update({
    where: { userId },
    data: {
      status: snapshot.status,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      canceledAt: new Date(),
    },
    include: { plan: true },
  });
}
