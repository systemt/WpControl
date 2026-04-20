import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { ApiError } from '../../utils/api-error';
import { sanitizeAdminUser, SafeAdminUser } from '../../utils/sanitize';
import type { LoginInput } from './auth.schema';

export async function loginAdmin(input: LoginInput): Promise<{ token: string; user: SafeAdminUser }> {
  const user = await prisma.adminUser.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.unauthorized('Invalid credentials');
  if (!user.isActive) throw ApiError.forbidden('User is not active');

  const match = await bcrypt.compare(input.password, user.passwordHash);
  if (!match) throw ApiError.unauthorized('Invalid credentials');

  const updated = await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({ sub: updated.id, email: updated.email, role: updated.role });

  return { token, user: sanitizeAdminUser(updated) };
}

export async function getMe(userId: string): Promise<SafeAdminUser> {
  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeAdminUser(user);
}
