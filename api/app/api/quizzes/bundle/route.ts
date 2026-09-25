import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listPublishedQuizBundle } from "@/lib/services/quizzes";
import { publicLocaleSchema } from "@/lib/validation/content";

const querySchema = z.object({ locale: publicLocaleSchema });

/** Every published quiz with full questions, for the offline sqflite cache. */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const items = await listPublishedQuizBundle(query.locale);
    return ok({ locale: query.locale, items, count: items.length });
  },
});
