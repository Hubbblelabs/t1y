import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { listPublishedQuizzes } from "@/lib/services/quizzes";
import { paginationSchema, toSkipTake } from "@/lib/validation/common";
import { publicLocaleSchema } from "@/lib/validation/content";
import { slugSchema } from "@/lib/validation/admin";

const querySchema = z
  .object({
    locale: publicLocaleSchema,
    topicSlug: slugSchema.optional(),
  })
  .and(paginationSchema);

/** Published quizzes for participants, without question bodies (list only). */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listPublishedQuizzes({
      locale: query.locale,
      topicSlug: query.topicSlug,
      skip,
      take,
    });
    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});
