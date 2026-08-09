import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import {
  getPublishedEducationBySlug,
  incrementViewCount,
} from "@/lib/services/education";

const paramsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Invalid article reference."),
});

export const GET = defineRoute({
  params: paramsSchema,
  handler: async ({ params }) => {
    const article = await getPublishedEducationBySlug(params.slug);

    // Not awaited: a counter must never delay or fail the read.
    void incrementViewCount(article.id);

    return ok(article);
  },
});
