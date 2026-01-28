const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('QgDFT13W', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@storio.dev' },
    update: {},
    create: {
      email: 'admin@storio.dev',
      passwordHash,
      isAdmin: true,
      mustChangePassword: true,
    },
  });

  console.log('Created admin user:', admin.email);

  await prisma.appSettings.upsert({
    where: { key: 'placement_weights' },
    update: {},
    create: {
      key: 'placement_weights',
      value: JSON.stringify({ cpu: 30, ram: 30, disk: 20, network: 20 }),
    },
  });

  await prisma.appSettings.upsert({
    where: { key: 'ollama_model' },
    update: {},
    create: {
      key: 'ollama_model',
      value: JSON.stringify({ model: 'llama3.2' }),
    },
  });

  console.log('Seed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
