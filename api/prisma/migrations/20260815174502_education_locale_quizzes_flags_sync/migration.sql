-- CreateEnum
CREATE TYPE "ContentLocale" AS ENUM ('EN', 'TA');

-- CreateEnum
CREATE TYPE "ContentBodyFormat" AS ENUM ('MARKDOWN', 'HTML');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE', 'MATCHING', 'ORDERING');

-- CreateEnum
CREATE TYPE "SyncEventType" AS ENUM ('TOPIC_OPEN', 'TOPIC_COMPLETION', 'QUIZ_ATTEMPT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EducationCategory" ADD VALUE 'HYPOGLYCAEMIA';
ALTER TYPE "EducationCategory" ADD VALUE 'SCHOOL_MANAGEMENT';
ALTER TYPE "EducationCategory" ADD VALUE 'TRAVEL';
ALTER TYPE "EducationCategory" ADD VALUE 'DIABAG';

-- DropIndex
DROP INDEX "EducationContent_category_idx";

-- DropIndex
DROP INDEX "EducationContent_slug_key";

-- DropIndex
DROP INDEX "EducationContent_status_category_idx";

-- AlterTable
ALTER TABLE "EducationContent" ADD COLUMN     "bodyFormat" "ContentBodyFormat" NOT NULL DEFAULT 'HTML',
ADD COLUMN     "bodySource" TEXT,
ADD COLUMN     "importChecksum" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "locale" "ContentLocale" NOT NULL DEFAULT 'EN';

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL DEFAULT 'EN',
    "topicSlug" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 0,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "questionKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "imageUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "matchText" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "correctPosition" INTEGER,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "scorePercent" INTEGER,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "pointsPossible" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN,
    "durationSeconds" INTEGER,
    "attemptNumber" INTEGER NOT NULL,
    "quizVersion" INTEGER NOT NULL DEFAULT 1,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResponse" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "secondsSpent" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SyncEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockSkewSeconds" INTEGER,
    "deviceId" TEXT,
    "appVersion" TEXT,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("clientId")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "safetyNotice" TEXT,
    "clinicalSafety" BOOLEAN NOT NULL DEFAULT false,
    "publicRead" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Quiz_status_locale_idx" ON "Quiz"("status", "locale");

-- CreateIndex
CREATE INDEX "Quiz_topicSlug_locale_idx" ON "Quiz"("topicSlug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_slug_locale_key" ON "Quiz"("slug", "locale");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_position_idx" ON "QuizQuestion"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuizQuestion_quizId_questionKey_key" ON "QuizQuestion"("quizId", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuizOption_questionId_position_key" ON "QuizOption"("questionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_clientId_key" ON "QuizAttempt"("clientId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_startedAt_idx" ON "QuizAttempt"("userId", "quizId", "startedAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_completedAt_idx" ON "QuizAttempt"("quizId", "completedAt");

-- CreateIndex
CREATE INDEX "QuizResponse_questionId_idx" ON "QuizResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizResponse_attemptId_questionId_key" ON "QuizResponse"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "TopicProgress_topicSlug_completedAt_idx" ON "TopicProgress"("topicSlug", "completedAt");

-- CreateIndex
CREATE INDEX "TopicProgress_userId_completedAt_idx" ON "TopicProgress"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopicProgress_userId_topicSlug_key" ON "TopicProgress"("userId", "topicSlug");

-- CreateIndex
CREATE INDEX "SyncEvent_userId_receivedAt_idx" ON "SyncEvent"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "SyncEvent_type_occurredAt_idx" ON "SyncEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "EducationContent_status_locale_category_idx" ON "EducationContent"("status", "locale", "category");

-- CreateIndex
CREATE INDEX "EducationContent_slug_idx" ON "EducationContent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EducationContent_slug_locale_key" ON "EducationContent"("slug", "locale");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

