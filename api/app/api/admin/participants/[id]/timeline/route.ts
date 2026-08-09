import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertCanViewParticipantHealthData } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getParticipantTimeline } from "@/lib/services/participants";
import { dateRangeSchema, idParamSchema, resolveDateRange } from "@/lib/validation/common";

const querySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
  .and(dateRangeSchema);

/** Merged, reverse-chronological activity feed for one participant. */
export const GET = defineRoute({
  capability: Capability.HEALTH_DATA_VIEW,
  params: idParamSchema,
  query: querySchema,
  handler: async ({ principal, params, query }) => {
    await assertCanViewParticipantHealthData(principal, params.id);

    const { from, to } = resolveDateRange(query);
    const entries = await getParticipantTimeline({
      userId: params.id,
      from,
      to,
      limit: query.limit,
    });

    return ok(entries, {
      meta: { range: { from: from.toISOString(), to: to.toISOString() } },
    });
  },
});
