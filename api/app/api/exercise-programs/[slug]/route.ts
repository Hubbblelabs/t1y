import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPublishedProgramBySlug } from "@/lib/services/exercise-content";

const paramsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Invalid programme reference."),
});

export const GET = defineRoute({
  params: paramsSchema,
  handler: async ({ params }) => ok(await getPublishedProgramBySlug(params.slug)),
});
