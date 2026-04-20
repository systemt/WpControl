import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@digiforce.local';
  const password = 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'super_admin',
      isActive: true,
    },
  });

  console.log(`Seeded admin user: ${user.email} (role: ${user.role})`);
  console.log(`Default password: ${password} — change it after first login.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
