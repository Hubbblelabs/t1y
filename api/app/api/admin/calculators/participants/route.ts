import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { searchParticipantsForCalculator } from "@/lib/services/calculator-run";

const querySchema = z.object({ search: z.string().trim().max(120).optional() });

/** GET /api/admin/calculators/participants?search= — the picker in the workbench. */
export const GET = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  query: querySchema,
  handler: async ({ query }) => ok(await searchParticipantsForCalculator(query.search)),
});
