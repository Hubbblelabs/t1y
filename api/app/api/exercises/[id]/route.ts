import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteExerciseLog,
  getExerciseLog,
  updateExerciseLog,
} from "@/lib/services/exercise";
import { idParamSchema } from "@/lib/validation/common";
import { updateExerciseLogSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const log = await getExerciseLog(params.id);
    assertOwnsRecord(principal, log.userId);

    const { userId: _ownerId, ...rest } = log;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateExerciseLogSchema,
  handler: async ({ principal, params, body }) => {
    const log = await getExerciseLog(params.id);
    assertOwnsRecord(principal, log.userId);

    return ok(await updateExerciseLog(params.id, body));
  },
});

export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const log = await getExerciseLog(params.id);
    assertOwnsRecord(principal, log.userId);

    await deleteExerciseLog(params.id);
    return noContent();
  },
});
