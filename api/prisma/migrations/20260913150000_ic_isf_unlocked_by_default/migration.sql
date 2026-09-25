-- The per-child clinical gate on the IC/ISF calculator was deliberately
-- removed (product decision, confirmed explicitly given the clinical-safety
-- implications) — every child gets the calculator by default now, not just
-- new ones going forward.

-- AlterTable: new rows default to unlocked.
ALTER TABLE "Profile" ALTER COLUMN "icIsfUnlocked" SET DEFAULT true;

-- Backfill: unlock it for every child already on file too.
UPDATE "Profile" SET "icIsfUnlocked" = true WHERE "icIsfUnlocked" = false;
