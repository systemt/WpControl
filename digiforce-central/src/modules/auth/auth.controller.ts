import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import { getMe, loginUser, signupUser } from './auth.service';
import type { LoginInput, SignupInput } from './auth.schema';

export const postLogin: RequestHandler = asyncHandler(async (req, res) => {
  const data = await loginUser(req.body as LoginInput);
  res.json({ success: true, data });
});

export const postSignup: RequestHandler = asyncHandler(async (req, res) => {
  const data = await signupUser(req.body as SignupInput);
  res.status(201).json({ success: true, data });
});

export const postLogout: RequestHandler = (_req, res) => {
  res.json({ success: true, data: { message: 'Logged out' } });
};

export const getMeHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await getMe(req.user.id);
  res.json({ success: true, data: user });
});
