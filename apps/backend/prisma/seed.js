const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminFullName = process.env.SEED_ADMIN_FULLNAME || 'Falcon Admin';

  if (!adminEmail || !adminPassword) {
    console.log(
      'Skipping admin seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create admin user.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: {
      email: adminEmail.toLowerCase(),
    },
    update: {
      fullName: adminFullName,
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email: adminEmail.toLowerCase(),
      fullName: adminFullName,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Admin seeded: ${adminEmail.toLowerCase()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
