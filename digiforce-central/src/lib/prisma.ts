import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Reuse the client across hot reloads in development.
const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
