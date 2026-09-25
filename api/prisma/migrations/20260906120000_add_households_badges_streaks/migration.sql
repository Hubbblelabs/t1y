-- CreateEnum
CREATE TYPE "BadgeTier" AS ENUM ('GOLD', 'SILVER', 'BRONZE', 'RISING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "householdId" TEXT;

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "parentName" TEXT NOT NULL,
    "mpinHash" TEXT,
    "mpinSetAt" TIMESTAMP(3),
    "mpinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "mpinLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "tier" "BadgeTier" NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "attemptId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastVisitOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_email_key" ON "Household"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Household_phone_key" ON "Household"("phone");

-- CreateIndex
CREATE INDEX "Household_phone_idx" ON "Household"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "QuizBadge_attemptId_key" ON "QuizBadge"("attemptId");

-- CreateIndex
CREATE INDEX "QuizBadge_userId_earnedAt_idx" ON "QuizBadge"("userId", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizBadge_userId_quizId_key" ON "QuizBadge"("userId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitStreak_userId_key" ON "VisitStreak"("userId");

-- CreateIndex
CREATE INDEX "User_householdId_idx" ON "User"("householdId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizBadge" ADD CONSTRAINT "QuizBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizBadge" ADD CONSTRAINT "QuizBadge_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitStreak" ADD CONSTRAINT "VisitStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

