import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * One-off repair for households.addChild()'s credential bug (fixed in
 * lib/services/households.ts): every child added under a household *before*
 * that fix has a `User` row but no `Account` credential row at all, so
 * signing in as that child fails with "sign in details didn't match" no
 * matter what the parent types — there was nothing to check the password
 * against.
 *
 * This finds every such child, copies the household's own credential
 * (resolved via any sibling who already has one — usually the first child,
 * created at sign-up) onto a new Account row for them, and reports what it
 * did. Never overwrites an existing credential, and never invents a
 * password — it only copies the one the family already uses.
 *
 * Run with: npx tsx scripts/backfill-child-credentials.ts
 * Add --dry-run to report what it would do without writing anything.
 */

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const households = await prisma.household.findMany({
    select: {
      id: true,
      parentName: true,
      children: {
        where: { role: "PATIENT", deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          accounts: { where: { providerId: "credential" }, select: { id: true, password: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let fixed = 0;
  let skippedNoSource = 0;
  let alreadyOk = 0;

  for (const household of households) {
    const withCredential = household.children.find(
      (c) => c.accounts[0]?.password,
    );
    const missing = household.children.filter((c) => c.accounts.length === 0);

    alreadyOk += household.children.length - missing.length;

    if (missing.length === 0) continue;

    if (!withCredential) {
      // Every child in this household is missing a credential — nothing to
      // copy from. Shouldn't happen (the first child is created at sign-up
      // with a real password), but reported rather than guessed at.
      console.warn(
        `⚠ Household "${household.parentName}" (${household.id}): ${missing.length} child(ren) missing a credential, and no sibling has one to copy. Needs manual attention.`,
      );
      skippedNoSource += missing.length;
      continue;
    }

    for (const child of missing) {
      console.log(
        `${dryRun ? "[dry-run] would fix" : "Fixing"}: ${child.name} <${child.email}> in household "${household.parentName}"`,
      );
      if (!dryRun) {
        await prisma.account.create({
          data: {
            userId: child.id,
            providerId: "credential",
            accountId: child.id,
            password: withCredential.accounts[0]!.password!,
          },
        });
      }
      fixed++;
    }
  }

  console.log("\n—— Summary ——");
  console.log(`Already had a credential: ${alreadyOk}`);
  console.log(`${dryRun ? "Would fix" : "Fixed"}: ${fixed}`);
  if (skippedNoSource > 0) {
    console.log(`Could not fix (no sibling credential to copy): ${skippedNoSource}`);
  }
  if (dryRun) console.log("\nThis was a dry run — nothing was written. Re-run without --dry-run to apply.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
