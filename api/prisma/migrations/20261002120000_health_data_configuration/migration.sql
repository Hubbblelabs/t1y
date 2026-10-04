-- CreateEnum
CREATE TYPE "GlucoseSlot" AS ENUM ('PRE_BREAKFAST', 'POST_BREAKFAST', 'PRE_LUNCH', 'POST_LUNCH', 'PRE_DINNER', 'POST_DINNER');

-- AlterTable
ALTER TABLE "GlucoseReading" ADD COLUMN     "slot" "GlucoseSlot";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "exerciseEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exerciseReminderHours" INTEGER,
ADD COLUMN     "glucoseSlots" "GlucoseSlot"[] DEFAULT ARRAY['PRE_BREAKFAST', 'POST_BREAKFAST', 'PRE_LUNCH', 'POST_LUNCH', 'PRE_DINNER', 'POST_DINNER']::"GlucoseSlot"[],
ADD COLUMN     "insulinIntervalHours" INTEGER;
