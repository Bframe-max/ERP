import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const settings = await prisma.settings.findMany();
  const fondos = await prisma.fondos_financieros.findMany();
  console.log("SETTINGS:", settings);
  console.log("FONDOS:", fondos);
}

check().catch(console.error).finally(() => prisma.$disconnect());
