import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3] || 'Admin2026';

  if (!email) {
    console.log('Usage: node make-admin.js <email> [password]');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'SYSTEM_ADMIN', organizationId: null, status: 'ACTIVE' },
    });
    console.log(`User ${email} updated to SYSTEM_ADMIN.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: 'System Admin',
        role: 'SYSTEM_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    console.log(`User ${email} created as SYSTEM_ADMIN.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
