/*
  Exercise programmes out, calculators in.

  The "Exercise programmes" content section was pre-existing surface from the
  generic platform this deployment was built from. This study's app never had
  a screen for it, so it only ever showed an empty table to a coordinator
  wondering what it was for. Removing it was a deliberate product decision,
  and deleting the data with it was confirmed explicitly.

  Both drops below were checked against the database first: ExerciseContent
  held 0 rows and ExerciseLog held 0 rows, so neither the table drop nor the
  dropped `programId` column destroys any real record.

  ExerciseLog and Exercise themselves are NOT touched — those belong to the
  health-logging feature (gated by the health_logging_enabled flag), not to
  the admin content section being removed here. Only the link from a logged
  session to an authored programme goes, because the programmes are going.

  Calculator replaces it. Note it has no "edit" story by design: see the
  model's own comment in schema.prisma — the formulas produce insulin
  guidance, so a calculator is created once and thereafter only hidden.

  Warnings from the generator, kept for the record:
  - You are about to drop the column `programId` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the `ExerciseContent` table. If the table is not empty, all the data it contains will be lost.
*/
-- DropForeignKey
ALTER TABLE "ExerciseContent" DROP CONSTRAINT "ExerciseContent_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_programId_fkey";

-- AlterTable
ALTER TABLE "ExerciseLog" DROP COLUMN "programId";

-- DropTable
DROP TABLE "ExerciseContent";

-- CreateTable
CREATE TABLE "Calculator" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTa" TEXT,
    "descriptionEn" TEXT,
    "descriptionTa" TEXT,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "noteEn" TEXT,
    "noteTa" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "supersededById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calculator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Calculator_key_key" ON "Calculator"("key");

-- CreateIndex
CREATE INDEX "Calculator_active_sortOrder_idx" ON "Calculator"("active", "sortOrder");

-- AddForeignKey
ALTER TABLE "Calculator" ADD CONSTRAINT "Calculator_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
