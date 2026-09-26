/**
 * Compares row counts, table by table, between the local development
 * database and whatever DATABASE_URL currently points at (Neon, once
 * switched over) — the check that nothing silently failed to copy.
 *
 * Run with: npx tsx scripts/verify-cloud-migration.ts
 *
 * Reads the local connection string from LOCAL_DATABASE_URL (falls back to
 * the standard docker-compose.dev.yml address) and the target from
 * DATABASE_URL / .env, so it can run after .env has already been switched to
 * point at Neon.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ?? "postgresql://t1dpe:t1dpe_dev_only@127.0.0.1:5433/t1dpe";
const TARGET_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!TARGET_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const local = new PrismaClient({ adapter: new PrismaPg({ connectionString: LOCAL_URL }) });
const target = new PrismaClient({ adapter: new PrismaPg({ connectionString: TARGET_URL }) });

async function tableNames(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<{ tablename: string }[]>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  return rows.map((r) => r.tablename);
}

async function count(client: PrismaClient, table: string): Promise<number> {
  const rows = await client.$queryRawUnsafe<{ count: bigint }[]>(
    `select count(*)::bigint as count from "${table}"`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const tables = await tableNames(local);
  let mismatches = 0;

  console.log(`${"table".padEnd(34)} local    target`);
  for (const table of tables) {
    const [a, b] = await Promise.all([count(local, table), count(target, table)]);
    const same = a === b;
    if (!same) mismatches++;
    console.log(`${table.padEnd(34)} ${String(a).padStart(6)}   ${String(b).padStart(6)} ${same ? "" : "  ← mismatch"}`);
  }

  console.log(
    mismatches === 0
      ? "\nEvery table matches."
      : `\n${mismatches} table(s) do not match — see above.`,
  );
  process.exitCode = mismatches === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await local.$disconnect();
    await target.$disconnect();
  });
