import { prisma } from '../../lib/prisma';
import { sanitizeAdminUser, SafeAdminUser } from '../../utils/sanitize';

/**
 * Lists admin-role accounts only. The legacy `adminUser` model was unified
 * into the multi-tenant `User` table during the SaaS migration; admin
 * privilege is now a `role` flag rather than a separate table.
 */
export async function listAdmins(): Promise<SafeAdminUser[]> {
  const users = await prisma.user.findMany({
    where: { role: 'admin' },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(sanitizeAdminUser);
}

/**
 * Fetch any user by id (used for the authenticated session's profile lookup).
 * Role filtering happens at the route layer — keeping this open lets the
 * `/me` endpoint serve both regular tenants and super admins.
 */
export async function getAdminById(id: string): Promise<SafeAdminUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? sanitizeAdminUser(user) : null;
}
