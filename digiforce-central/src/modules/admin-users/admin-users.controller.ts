import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import { getAdminById, listAdmins } from './admin-users.service';

export const getMeHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await getAdminById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: user });
});

export const listAdminsHandler: RequestHandler = asyncHandler(async (_req, res) => {
  const users = await listAdmins();
  res.json({ success: true, data: users });
});
