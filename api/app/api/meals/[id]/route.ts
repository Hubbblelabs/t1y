import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import { deleteMeal, getMeal, updateMeal } from "@/lib/services/meals";
import { idParamSchema } from "@/lib/validation/common";
import { updateMealSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const meal = await getMeal(params.id);
    assertOwnsRecord(principal, meal.userId);

    const { userId: _ownerId, ...rest } = meal;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateMealSchema,
  handler: async ({ principal, params, body }) => {
    const meal = await getMeal(params.id);
    assertOwnsRecord(principal, meal.userId);

    return ok(await updateMeal(params.id, body));
  },
});

export const DELETE = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const meal = await getMeal(params.id);
    assertOwnsRecord(principal, meal.userId);

    await deleteMeal(params.id);
    return noContent();
  },
});
