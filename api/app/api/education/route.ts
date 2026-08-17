import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { listPublishedEducation } from "@/lib/services/education";
import { paginationSchema, searchSchema, toSkipTake } from "@/lib/validation/common";
import { educationCategorySchema } from "@/lib/validation/admin";
import { publicLocaleSchema } from "@/lib/validation/content";

const querySchema = z
  .object({
    category: educationCategorySchema.optional(),
    locale: publicLocaleSchema,
    search: searchSchema,
  })
  .and(paginationSchema);

/**
 * Published education content for participants. Drafts and archived articles
 * are only reachable through the administration API. Requesting `locale=ta`
 * returns the Tamil article where one is published, and silently falls back
 * to English (flagged via `isFallback` on each item) where it isn't — a
 * missing translation must never remove a topic from a participant's
 * curriculum.
 */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total, requestedLocale } = await listPublishedEducation({
      locale: query.locale,
      category: query.category,
      search: query.search,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      requestedLocale,
    });
  },
});
