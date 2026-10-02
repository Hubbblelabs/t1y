-- AlterTable
ALTER TABLE "GuardianShare" ADD COLUMN     "collect" TEXT[] DEFAULT ARRAY['GLUCOSE', 'INSULIN', 'CARBS', 'EXERCISE']::TEXT[],
ADD COLUMN     "purpose" TEXT;
