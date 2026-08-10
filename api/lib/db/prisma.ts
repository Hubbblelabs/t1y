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

/**
 * Pool tuning.
 *
 * Managed Postgres (Neon, and the local `prisma dev` server) closes idle
 * server-side connections after a short period. A pooled client that keeps
 * handles around for longer than that will eventually hand out a dead socket
 * and fail the query with P1017 "Server has closed the connection".
 *
 * Recycling our own idle connections well before the server does avoids that,
 * and TCP keep-alive stops an idle-but-live connection from being dropped by
 * an intermediate NAT.
 */
const POOL_CONFIG = {
  // Serverless runs many small instances; a large per-instance pool would
  // exhaust the database's connection limit rather than help throughput.
  // Development is deliberately smaller still: the local `prisma dev` server
  // caps the whole machine at 10 connections, which the dev server, the test
  // runner and any ad-hoc script have to share.
  max: isProduction() ? 5 : 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
  // Recycle connections periodically so none is reused indefinitely.
  maxLifetimeSeconds: 1_800,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5_000,
} as const;

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    ...POOL_CONFIG,
  });

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
