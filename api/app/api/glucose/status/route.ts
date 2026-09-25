import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getGlucoseEntryStatus } from "@/lib/services/glucose";

/**
 * GET /api/glucose/status — whether the caller may record another glucose
 * reading right now, and when they may next if not.
 *
 * The app reads this before showing the entry form, so the cooldown reads
 * as "come back at 6:00 PM" rather than a rejected save — but the same rule
 * is re-checked server-side in createGlucoseReading, since a stale screen
 * or a direct call must not be able to skip it.
 */
export const GET = defineRoute({
  handler: async ({ principal }) => ok(await getGlucoseEntryStatus(principal.userId)),
});
