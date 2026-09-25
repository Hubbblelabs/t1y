
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('PATIENT', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "NotificationCampaign" ALTER COLUMN "targetRole" TYPE "UserRole_new" USING ("targetRole"::text::"UserRole_new");
ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" TYPE "UserRole_new" USING ("actorRole"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PATIENT';
COMMIT;

