import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listSosContactsForChild } from "@/lib/services/sos-contacts";

/**
 * GET /api/sos-contacts — the emergency contacts this child's app shows.
 * Deliberately not behind the health-logging flag: reaching a doctor must not
 * depend on a study switch.
 */
export const GET = defineRoute({
  handler: async ({ principal }) => ok(await listSosContactsForChild(principal.userId)),
});
