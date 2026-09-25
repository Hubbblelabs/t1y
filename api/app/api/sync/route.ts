import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { pushSyncBatch, type SyncEventInput } from "@/lib/services/sync";
import { syncPushSchema } from "@/lib/validation/sync";

/**
 * Offline sync push. Always returns 200 when the envelope itself is valid —
 * per-event failures are reported in `rejected`, never as a batch-level
 * error, so one malformed event can't wedge a device. See
 * lib/services/sync.ts for the full contract.
 */
export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: syncPushSchema,
  handler: async ({ principal, body }) => {
    const events = body.events as unknown as SyncEventInput[];
    const { accepted, rejected } = await pushSyncBatch(principal.userId, events);

    return ok({ accepted, rejected, serverTime: new Date().toISOString() });
  },
});
