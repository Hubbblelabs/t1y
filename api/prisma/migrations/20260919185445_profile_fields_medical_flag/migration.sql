-- AlterTable
ALTER TABLE "ProfileFieldDefinition" ADD COLUMN     "isMedical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit" TEXT;
