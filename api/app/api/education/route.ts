import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { listPublishedEducation } from "@/lib/services/education";
import { paginationSchema, searchSchema, toSkipTake } from "@/lib/validation/common";

const querySchema = z
  .object({
    category: z
      .enum([
        "DIABETES_BASICS",
        "GLUCOSE_MANAGEMENT",
        "MEDICATION",
        "INSULIN",
        "NUTRITION",
        "EXERCISE",
        "LIFESTYLE",
        "STRESS_MANAGEMENT",
        "GENERAL_WELLNESS",
      ])
      .optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

/**
 * Published education content for participants. Drafts and archived articles
 * are only reachable through the administration API.
 */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listPublishedEducation({
      category: query.category,
      search: query.search,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});
