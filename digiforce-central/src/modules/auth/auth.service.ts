import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { ApiError } from '../../utils/api-error';
import { sanitizeUser, SafeUser } from '../../utils/sanitize';
import { config } from '../../config';
import type { LoginInput, SignupInput } from './auth.schema';

/**
 * Legacy export name kept for any callers that still reference it — now
 * validates against the unified `users` table.
 */
export async function loginAdmin(input: LoginInput) {
  return loginUser(input);
}

export async function loginUser(input: LoginInput): Promise<{ token: string; user: SafeUser }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.unauthorized('Invalid credentials');
  if (!user.isActive) throw ApiError.forbidden('User is not active');

  const match = await bcrypt.compare(input.password, user.passwordHash);
  if (!match) throw ApiError.unauthorized('Invalid credentials');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({ sub: updated.id, email: updated.email, role: updated.role });
  return { token, user: sanitizeUser(updated) };
}

/**
 * Creates a new tenant user + a trial Subscription on the default plan so the
 * user can add sites immediately. No billing provider is touched here — the
 * billing module is responsible for any paid upgrades.
 */
export async function signupUser(input: SignupInput): Promise<{ token: string; user: SafeUser }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'user',
      isActive: true,
    },
  });

  // Attach a trial subscription to the configured default plan if present.
  const defaultPlan = await prisma.plan.findUnique({
    where: { slug: config.DEFAULT_TRIAL_PLAN_SLUG },
  });

  if (defaultPlan) {
    const trialEndsAt =
      config.DEFAULT_TRIAL_DAYS > 0
        ? new Date(Date.now() + config.DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000)
        : null;

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: defaultPlan.id,
        status: trialEndsAt ? 'trialing' : 'active',
        provider: config.BILLING_PROVIDER,
        trialEndsAt,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      },
    });
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return { token, user: sanitizeUser(user) };
}

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
}
