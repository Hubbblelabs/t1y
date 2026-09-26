import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * One-off: makes every existing family account usable straight away — active,
 * and with its email treated as verified — matching how accounts are created
 * now (no coordinator approval, no email verification).
 *
 * Run with: npx tsx scripts/activate-family-accounts.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const where = { role: "PATIENT" as const, deletedAt: null };
  const activated = await prisma.user.updateMany({
    where: { ...where, status: "PENDING" },
    data: { status: "ACTIVE" },
  });
  const verified = await prisma.user.updateMany({
    where: { ...where, emailVerified: false },
    data: { emailVerified: true },
  });
  console.log(`Activated ${activated.count}; marked verified ${verified.count}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
