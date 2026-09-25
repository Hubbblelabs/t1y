import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteGlucoseReading,
  getGlucoseReading,
  updateGlucoseReading,
} from "@/lib/services/glucose";
import { idParamSchema } from "@/lib/validation/common";
import { updateGlucoseSchema } from "@/lib/validation/health";

/**
 * A participant may read, correct and delete their own readings. Ownership is
 * verified against the stored record, never inferred from the request.
 */

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const reading = await getGlucoseReading(params.id);
    assertOwnsRecord(principal, reading.userId);

    const { userId: _ownerId, ...rest } = reading;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateGlucoseSchema,
  handler: async ({ principal, params, body }) => {
    const reading = await getGlucoseReading(params.id);
    assertOwnsRecord(principal, reading.userId);

    return ok(await updateGlucoseReading(params.id, body));
  },
});

export const DELETE = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const reading = await getGlucoseReading(params.id);
    assertOwnsRecord(principal, reading.userId);

    await deleteGlucoseReading(params.id);
    return noContent();
  },
});
