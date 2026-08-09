import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

/**
 * Prisma 7 requires a driver adapter. `PrismaPg` speaks plain TCP to Postgres,
 * which is what Neon's pooled endpoint expects from a Node serverless runtime.
 *
 * The client is cached on `globalThis` so that Next.js hot reloading in
 * development does not open a new connection pool on every edit.
 */

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // Never log query parameters — they contain participant health data.
    log: isProduction() ? ["error"] : ["error", "warn"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!isProduction()) {
  globalForPrisma.prisma = prisma;
}
