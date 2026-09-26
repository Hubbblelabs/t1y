-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: existing rows predate this column and get the same NOT NULL
-- default a freshly-created row would.
UPDATE "AdminUser" SET "capabilities" = ARRAY[]::TEXT[] WHERE "capabilities" IS NULL;

ALTER TABLE "AdminUser" ALTER COLUMN "capabilities" SET NOT NULL;
