import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createGalleryItem, listGalleryItems } from "@/lib/services/gallery";
import { galleryItemSchema } from "@/lib/validation/gallery";

// EDUCATION_MANAGE, like quizzes and SOS contacts: whoever decides what
// families are shown.
export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  handler: async () => ok(await listGalleryItems()),
});

export const POST = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: galleryItemSchema,
  handler: async ({ principal, body, audit }) => {
    const item = await createGalleryItem(body);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.GALLERY_CREATED,
        resourceType: "gallery_item",
        resourceId: item.id,
        description: `Added gallery ${item.kind.toLowerCase()} "${item.title}"`,
      },
      audit,
    );
    return created(item);
  },
});
