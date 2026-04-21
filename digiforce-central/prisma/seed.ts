import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the three default plans and the super-admin account.
 *
 * Safe to run repeatedly — every upsert is idempotent.
 */
async function main() {
  // ── Plans ────────────────────────────────────────────────────────────────
  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      description: 'Perfect for small agencies getting started.',
      maxSites: 5,
      priceMonthly: 1900, // $19.00 / month
      features: ['Up to 5 sites', 'Daily sync', 'Email support'],
      sortOrder: 1,
      providerPriceId: process.env.STRIPE_PRICE_STARTER || null,
    },
    {
      slug: 'pro',
      name: 'Pro',
      description: 'For growing teams managing a dozen-plus sites.',
      maxSites: 20,
      priceMonthly: 4900, // $49.00 / month
      features: ['Up to 20 sites', 'Hourly sync', 'Priority support', 'Bulk updates'],
      sortOrder: 2,
      providerPriceId: process.env.STRIPE_PRICE_PRO || null,
    },
    {
      slug: 'agency',
      name: 'Agency',
      description: 'Unlimited sites with SLA.',
      maxSites: null, // unlimited
      priceMonthly: 14900, // $149.00 / month
      features: ['Unlimited sites', 'Hourly sync', 'Priority support', 'Bulk updates', 'SLA'],
      sortOrder: 3,
      providerPriceId: process.env.STRIPE_PRICE_AGENCY || null,
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        maxSites: p.maxSites,
        priceMonthly: p.priceMonthly,
        features: p.features,
        sortOrder: p.sortOrder,
        providerPriceId: p.providerPriceId,
        isPublic: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        maxSites: p.maxSites,
        priceMonthly: p.priceMonthly,
        features: p.features,
        sortOrder: p.sortOrder,
        providerPriceId: p.providerPriceId,
        isPublic: true,
      },
    });
  }

  // ── Super admin user ─────────────────────────────────────────────────────
  const email = 'admin@digiforce.local';
  const password = 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'admin', isActive: true },
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  // ── Backfill: assign any ownerless sites to the super admin ─────────────
  const orphanCount = await prisma.site.count({ where: { userId: '' } }).catch(() => 0);
  if (orphanCount > 0) {
    await prisma.site.updateMany({
      where: { userId: '' },
      data: { userId: admin.id },
    });
    console.log(`Backfilled ${orphanCount} legacy site(s) → admin user.`);
  }

  console.log(`Seeded ${plans.length} plans.`);
  console.log(`Admin: ${admin.email} / ${password} (role: ${admin.role}) — change the password after first login.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
