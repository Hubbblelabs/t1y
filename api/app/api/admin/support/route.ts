import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { countAwaitingReply, listSupportThreadsForAdmin } from "@/lib/services/support";
import { supportThreadListQuerySchema } from "@/lib/validation/admin";

/**
 * GET /api/admin/support — the help inbox.
 *
 * Unanswered questions first: the list is ordered by the job, which is
 * "who is still waiting on us".
 */
export const GET = defineRoute({
  capability: Capability.SUPPORT_RESPOND,
  query: supportThreadListQuerySchema,
  handler: async ({ query }) => {
    const [threads, awaiting] = await Promise.all([
      listSupportThreadsForAdmin({ status: query.status }),
      countAwaitingReply(),
    ]);
    return ok({ threads, awaitingReply: awaiting });
  },
});
