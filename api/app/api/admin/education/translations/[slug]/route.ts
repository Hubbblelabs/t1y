import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { getEducationTranslations } from "@/lib/services/education";
import { slugSchema } from "@/lib/validation/admin";

const paramsSchema = z.object({ slug: slugSchema });

/** The EN/TA pair for a topic, for the admin translation-pair panel. */
export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  params: paramsSchema,
  handler: async ({ params }) => ok(await getEducationTranslations(params.slug)),
});
