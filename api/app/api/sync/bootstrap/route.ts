import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSyncBootstrap } from "@/lib/services/sync";
import { syncBootstrapQuerySchema } from "@/lib/validation/sync";

/**
 * Content + quiz bundles plus the caller's own progress, in one response.
 * What a device calls on install or after a factory reset to recover state
 * without re-downloading every topic individually.
 */
export const GET = defineRoute({
  query: syncBootstrapQuerySchema,
  handler: async ({ principal, query }) => ok(await getSyncBootstrap(principal.userId, query.locale)),
});
