import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { listPublishedPrograms } from "@/lib/services/exercise-content";
import { paginationSchema, toSkipTake } from "@/lib/validation/common";
import { exerciseCategorySchema } from "@/lib/validation/health";

const querySchema = z
  .object({
    category: exerciseCategorySchema.optional(),
    difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  })
  .and(paginationSchema);

/** Published guided exercise programmes. */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listPublishedPrograms({
      category: query.category,
      difficulty: query.difficulty,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});
