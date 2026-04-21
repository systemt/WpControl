import type { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Strip the password hash before sending a user to the client.
 */
export function sanitizeUser(user: User): SafeUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

// Backwards compatible alias — earlier code referenced sanitizeAdminUser.
export const sanitizeAdminUser = sanitizeUser;
export type SafeAdminUser = SafeUser;
