import { assertCronRequest } from "@/lib/api/cron";
import { isAppError } from "@/lib/api/errors";
import { fromAppError, internalError, ok } from "@/lib/api/response";
import { dispatchCampaign, findDueCampaigns } from "@/lib/services/notifications";
import { logger } from "@/lib/utils/logger";
import { captureException } from "@/lib/observability/sentry";

/**
 * Dispatches scheduled notification campaigns (Vercel Cron, every 15 minutes).
 *
 * One failing campaign must not stop the rest of the batch, so each dispatch is
 * isolated and failures are reported individually.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertCronRequest(request);

    const due = await findDueCampaigns(new Date());
    const results: Array<{ id: string; sent: number; failed: boolean }> = [];

    for (const campaign of due) {
      try {
        const result = await dispatchCampaign(campaign.id);
        results.push({ id: campaign.id, sent: result.sent, failed: false });
      } catch (error) {
        logger.error("cron.campaign_dispatch_failed", {
          campaignId: campaign.id,
          reason: error instanceof Error ? error.message : "unknown",
        });
        captureException(error, { path: "/api/cron/campaigns" });
        results.push({ id: campaign.id, sent: 0, failed: true });
      }
    }

    logger.info("cron.campaigns", {
      processed: results.length,
      failed: results.filter((entry) => entry.failed).length,
    });

    return ok({ processed: results.length, results });
  } catch (error) {
    if (isAppError(error)) return fromAppError(error);

    captureException(error, { path: "/api/cron/campaigns" });
    return internalError();
  }
}
