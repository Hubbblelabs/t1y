import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteHealthMetric,
  getHealthMetric,
  updateHealthMetric,
} from "@/lib/services/health-metrics";
import { idParamSchema } from "@/lib/validation/common";
import { updateHealthMetricSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const metric = await getHealthMetric(params.id);
    assertOwnsRecord(principal, metric.userId);

    const { userId: _ownerId, ...rest } = metric;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateHealthMetricSchema,
  handler: async ({ principal, params, body }) => {
    const metric = await getHealthMetric(params.id);
    assertOwnsRecord(principal, metric.userId);

    return ok(await updateHealthMetric(params.id, body));
  },
});

export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const metric = await getHealthMetric(params.id);
    assertOwnsRecord(principal, metric.userId);

    await deleteHealthMetric(params.id);
    return noContent();
  },
});
