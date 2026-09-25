-- AlterTable
ALTER TABLE "ProfileFieldDefinition" ADD COLUMN     "builtIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rules" JSONB,
ADD COLUMN     "showOnSignup" BOOLEAN NOT NULL DEFAULT false;
