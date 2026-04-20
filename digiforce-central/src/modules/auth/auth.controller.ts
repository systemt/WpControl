import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import { getMe, loginAdmin } from './auth.service';
import type { LoginInput } from './auth.schema';

export const postLogin: RequestHandler = asyncHandler(async (req, res) => {
  const data = await loginAdmin(req.body as LoginInput);
  res.json({ success: true, data });
});

export const postLogout: RequestHandler = (_req, res) => {
  // JWTs are stateless — the client is expected to discard the token.
  res.json({ success: true, data: { message: 'Logged out' } });
};

export const getMeHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await getMe(req.user.id);
  res.json({ success: true, data: user });
});
