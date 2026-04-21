import { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import { config } from '../../config';
import {
  applyPlanToUser,
  cancelSubscription,
  getMySubscription,
  startCheckout,
} from './billing.service';

const checkoutSchema = z.object({
  plan: z.string().min(1),
});

export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await getMySubscription(req.user.id);
  res.json({ success: true, data });
});

export const postCheckout: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { plan } = checkoutSchema.parse(req.body);
  const baseUrl = config.APP_URL.replace(/\/$/, '');
  const session = await startCheckout(
    req.user.id,
    plan,
    `${baseUrl}/billing?checkout=success`,
    `${baseUrl}/billing?checkout=cancelled`
  );
  res.json({ success: true, data: session });
});

export const postChangePlan: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { plan } = checkoutSchema.parse(req.body);
  const subscription = await applyPlanToUser(req.user.id, plan);
  res.json({ success: true, data: subscription });
});

export const postCancel: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const subscription = await cancelSubscription(req.user.id);
  res.json({ success: true, data: subscription });
});
