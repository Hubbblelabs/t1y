import { assertCronRequest } from "@/lib/api/cron";
import { isAppError } from "@/lib/api/errors";
import { fromAppError, internalError, ok } from "@/lib/api/response";
import { captureException } from "@/lib/observability/sentry";
import { sendGlucoseReminders } from "@/lib/services/glucose-reminders";
import { logger } from "@/lib/utils/logger";

/**
 * Scheduled glucose-logging reminders (Vercel Cron, hourly).
 *
 * Separate from /api/cron/reminders (which only fires a family's own,
 * individually scheduled reminders) because this one is computed fresh every
 * run from what has actually been recorded, not from a stored schedule —
 * see lib/services/glucose-reminders.ts.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertCronRequest(request);
    const result = await sendGlucoseReminders();
    return ok(result);
  } catch (error) {
    if (isAppError(error)) return fromAppError(error);

    logger.error("cron.glucose_reminders_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    captureException(error, { path: "/api/cron/glucose-reminders" });
    return internalError();
  }
}
