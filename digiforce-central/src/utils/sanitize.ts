import type { AdminUser } from '@prisma/client';

export type SafeAdminUser = Omit<AdminUser, 'passwordHash'>;

/**
 * Strip the password hash before sending an admin user to the client.
 */
export function sanitizeAdminUser(user: AdminUser): SafeAdminUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}
