import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { publicLocaleSchema } from "@/lib/validation/content";
import { listPublishedEducationBundle } from "@/lib/services/education";

const querySchema = z.object({ locale: publicLocaleSchema });

/**
 * Every published topic, full body included, in one response. This is what
 * the Flutter app actually calls at onboarding/refresh to populate its
 * offline sqflite cache — one request instead of one per topic, which
 * matters on the 3G connections this study's participants are likely on.
 * `/api/education` (paginated, no body) remains for the admin dashboard.
 */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ query }) => {
    const items = await listPublishedEducationBundle(query.locale);
    return ok({ locale: query.locale, items, count: items.length });
  },
});
