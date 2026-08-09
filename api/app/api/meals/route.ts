import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { createMeal, getNutritionSummary, listMeals } from "@/lib/services/meals";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { createMealSchema, mealQuerySchema } from "@/lib/validation/health";

/**
 * Meals. Nutrition values are participant-reported unless the record names a
 * `nutritionSource`; the summary reports how many meals in the period carried
 * one, so consumers can qualify the numbers honestly.
 */

export const GET = defineRoute({
  query: mealQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, summary] = await Promise.all([
      listMeals({
        userId: principal.userId,
        from,
        to,
        mealType: query.mealType,
        sortOrder: query.sortOrder,
        skip,
        take,
      }),
      getNutritionSummary({ userId: principal.userId, from, to }),
    ]);

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      summary,
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  },
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: createMealSchema,
  handler: async ({ principal, body }) => created(await createMeal(principal.userId, body)),
});
