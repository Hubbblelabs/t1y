import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteHbA1cRecord,
  getHbA1cRecord,
  updateHbA1cRecord,
} from "@/lib/services/hba1c";
import { idParamSchema } from "@/lib/validation/common";
import { updateHbA1cSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const record = await getHbA1cRecord(params.id);
    assertOwnsRecord(principal, record.userId);

    const { userId: _ownerId, ...rest } = record;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateHbA1cSchema,
  handler: async ({ principal, params, body }) => {
    const record = await getHbA1cRecord(params.id);
    assertOwnsRecord(principal, record.userId);

    return ok(await updateHbA1cRecord(params.id, body));
  },
});

export const DELETE = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const record = await getHbA1cRecord(params.id);
    assertOwnsRecord(principal, record.userId);

    await deleteHbA1cRecord(params.id);
    return noContent();
  },
});
