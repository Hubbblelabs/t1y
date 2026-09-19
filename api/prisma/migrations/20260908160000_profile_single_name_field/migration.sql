-- Collapse Profile.firstName + Profile.lastName into a single Profile.name.

-- AlterTable: add the new column nullable first so existing rows aren't rejected.
ALTER TABLE "Profile" ADD COLUMN "name" TEXT;

-- Backfill from the two columns being retired.
UPDATE "Profile" SET "name" = TRIM(BOTH ' ' FROM CONCAT("firstName", ' ', "lastName"));

-- Now that every row has a value, enforce NOT NULL.
ALTER TABLE "Profile" ALTER COLUMN "name" SET NOT NULL;

-- DropIndex
DROP INDEX "Profile_lastName_firstName_idx";

-- AlterTable: drop the retired columns.
ALTER TABLE "Profile" DROP COLUMN "firstName";
ALTER TABLE "Profile" DROP COLUMN "lastName";

-- CreateIndex
CREATE INDEX "Profile_name_idx" ON "Profile"("name");
