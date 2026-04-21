import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { prisma } from '../../lib/prisma';

export const listPublicPlans: RequestHandler = asyncHandler(async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { isPublic: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      maxSites: true,
      priceMonthly: true,
      currency: true,
      features: true,
    },
  });
  res.json({ success: true, data: plans });
});
