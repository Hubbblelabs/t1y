import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { renderMarkdown } from "@/lib/utils/markdown";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import { contentBodyFormatSchema } from "@/lib/validation/admin";

const bodySchema = z.object({
  bodySource: z.string().max(200_000),
  bodyFormat: contentBodyFormatSchema.default("MARKDOWN"),
});

/**
 * Renders exactly the bytes a participant would receive for a given source —
 * the same render path `createEducation`/`updateEducation` use — so an
 * author's live preview can never diverge from what gets stored. Without
 * this, "it looked fine in the editor" is the failure mode the Markdown
 * approach exists to avoid.
 */
export const POST = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: bodySchema,
  handler: async ({ body }) => {
    const html =
      body.bodyFormat === "MARKDOWN"
        ? renderMarkdown(body.bodySource)
        : sanitizeRichText(body.bodySource);
    return ok({ html });
  },
});
