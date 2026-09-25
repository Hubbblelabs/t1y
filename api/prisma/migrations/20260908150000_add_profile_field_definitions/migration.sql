-- CreateEnum
CREATE TYPE "ProfileFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'CHOICE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "customFieldValues" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ProfileFieldDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fieldType" "ProfileFieldType" NOT NULL DEFAULT 'TEXT',
    "section" TEXT NOT NULL DEFAULT 'Additional details',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "labelEn" TEXT NOT NULL,
    "labelTa" TEXT,
    "hintEn" TEXT,
    "hintTa" TEXT,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileFieldDefinition_key_key" ON "ProfileFieldDefinition"("key");

-- CreateIndex
CREATE INDEX "ProfileFieldDefinition_active_sortOrder_idx" ON "ProfileFieldDefinition"("active", "sortOrder");
