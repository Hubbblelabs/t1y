import { assertCronRequest } from "@/lib/api/cron";
import { isAppError } from "@/lib/api/errors";
import { pruneRateLimits } from "@/lib/api/rate-limit";
import { fromAppError, internalError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";
import { captureException } from "@/lib/observability/sentry";

/**
 * Daily housekeeping (Vercel Cron).
 *
 * Removes rows that have served their purpose: expired sessions, spent
 * verification tokens, stale rate-limit windows and lapsed export records.
 *
 * Audit logs are never pruned here. They are the compliance record and their
 * retention is a policy decision, not a cleanup task.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertCronRequest(request);

    const now = new Date();
    const exportCutoff = new Date(now.getTime() - 7 * 86_400_000);

    const [sessions, verifications, rateLimits, exports, staleDevices] =
      await Promise.all([
        prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
        pruneRateLimits(),
        prisma.dataExport.deleteMany({
          where: { createdAt: { lt: exportCutoff }, status: { in: ["COMPLETED", "FAILED"] } },
        }),
        // Push tokens unseen for 90 days are almost certainly dead.
        prisma.deviceToken.updateMany({
          where: {
            isActive: true,
            lastSeenAt: { lt: new Date(now.getTime() - 90 * 86_400_000) },
          },
          data: { isActive: false },
        }),
      ]);

    const summary = {
      expiredSessionsRemoved: sessions.count,
      expiredVerificationsRemoved: verifications.count,
      rateLimitRowsRemoved: rateLimits,
      exportRecordsRemoved: exports.count,
      devicesDeactivated: staleDevices.count,
    };

    logger.info("cron.maintenance", summary);
    return ok(summary);
  } catch (error) {
    if (isAppError(error)) return fromAppError(error);

    captureException(error, { path: "/api/cron/maintenance" });
    return internalError();
  }
}
