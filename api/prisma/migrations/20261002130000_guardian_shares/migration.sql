-- CreateEnum
CREATE TYPE "GuardianShareStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'LOCKED');

-- AlterTable
ALTER TABLE "GlucoseReading" ADD COLUMN     "enteredBy" TEXT;

-- AlterTable
ALTER TABLE "InsulinLog" ADD COLUMN     "enteredBy" TEXT;

-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "enteredBy" TEXT;

-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "enteredBy" TEXT;

-- CreateTable
CREATE TABLE "GuardianShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "codeEnc" TEXT NOT NULL,
    "status" "GuardianShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "guardianName" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianShare_tokenHash_key" ON "GuardianShare"("tokenHash");

-- CreateIndex
CREATE INDEX "GuardianShare_userId_createdAt_idx" ON "GuardianShare"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuardianShare" ADD CONSTRAINT "GuardianShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
