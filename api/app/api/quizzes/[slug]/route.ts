import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPublishedQuizBySlug } from "@/lib/services/quizzes";
import { publicLocaleSchema } from "@/lib/validation/content";

const paramsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Invalid quiz reference."),
});
const querySchema = z.object({ locale: publicLocaleSchema });

/**
 * Full quiz including questions and options (i.e. the answer key). Shipping
 * the key to the device is an intentional trade-off of offline-first quizzes
 * with no exam stakes — see lib/services/quizzes.ts.
 */
export const GET = defineRoute({
  params: paramsSchema,
  query: querySchema,
  handler: async ({ params, query }) => ok(await getPublishedQuizBySlug(params.slug, query.locale)),
});
