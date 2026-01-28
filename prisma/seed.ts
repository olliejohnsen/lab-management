import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
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

  // Create default placement algorithm weights
  const placementWeights = await prisma.appSettings.upsert({
    where: { key: 'placement_weights' },
    update: {},
    create: {
      key: 'placement_weights',
      value: JSON.stringify({
        cpu: 30,
        ram: 30,
        disk: 20,
        network: 20,
      }),
    },
  });

  console.log('Created placement weights:', placementWeights.value);

  // Create default Ollama model setting
  const ollamaModel = await prisma.appSettings.upsert({
    where: { key: 'ollama_model' },
    update: {},
    create: {
      key: 'ollama_model',
      value: JSON.stringify({ model: 'llama3.2' }),
    },
  });

  console.log('Created Ollama model setting:', ollamaModel.value);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
