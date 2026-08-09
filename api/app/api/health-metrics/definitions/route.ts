import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listMetricDefinitions } from "@/lib/services/health-metrics";

/**
 * GET /api/health-metrics/definitions
 *
 * The metrics currently being collected, with their units, value types and
 * input bounds. The mobile client should build its forms from this response
 * rather than hard-coding a metric list, so metrics added later appear without
 * an application release.
 */
export const GET = defineRoute({
  handler: async () => ok(await listMetricDefinitions()),
});
