import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteInsulinLog,
  getInsulinLog,
  updateInsulinLog,
} from "@/lib/services/insulin";
import { idParamSchema } from "@/lib/validation/common";
import { updateInsulinLogSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const log = await getInsulinLog(params.id);
    assertOwnsRecord(principal, log.userId);

    const { userId: _ownerId, ...rest } = log;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateInsulinLogSchema,
  handler: async ({ principal, params, body }) => {
    const log = await getInsulinLog(params.id);
    assertOwnsRecord(principal, log.userId);

    return ok(await updateInsulinLog(params.id, body));
  },
});

export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const log = await getInsulinLog(params.id);
    assertOwnsRecord(principal, log.userId);

    await deleteInsulinLog(params.id);
    return noContent();
  },
});
