import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { listCatalogueVariables } from "@/lib/services/health-data-catalogue";

/**
 * GET /api/admin/calculator-data
 *
 * Everything a calculator can be built out of without asking the parent to
 * type it: the health records families already keep, plus any profile field
 * marked as medical.
 *
 * Returned in full, including entries nothing has been recorded against yet
 * (`hasData: false`), so the dashboard can show an admin that a value exists
 * but is currently empty rather than leaving them to wonder why it is
 * missing from the list.
 */
export const GET = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  handler: async () => ok(await listCatalogueVariables()),
});
