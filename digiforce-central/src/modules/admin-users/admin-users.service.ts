import { prisma } from '../../lib/prisma';
import { sanitizeAdminUser, SafeAdminUser } from '../../utils/sanitize';

export async function listAdmins(): Promise<SafeAdminUser[]> {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return users.map(sanitizeAdminUser);
}

export async function getAdminById(id: string): Promise<SafeAdminUser | null> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  return user ? sanitizeAdminUser(user) : null;
}
