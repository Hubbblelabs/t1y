import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { deleteGalleryItem, getGalleryItem, updateGalleryItem } from "@/lib/services/gallery";
import { idParamSchema } from "@/lib/validation/common";
import { galleryItemSchema } from "@/lib/validation/gallery";

export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getGalleryItem(params.id)),
});

export const PUT = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: galleryItemSchema,
  handler: async ({ principal, params, body, audit }) => {
    const item = await updateGalleryItem(params.id, body);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.GALLERY_UPDATED,
        resourceType: "gallery_item",
        resourceId: params.id,
        description: `Updated gallery item "${item.title}"`,
      },
      audit,
    );
    return ok(item);
  },
});

export const DELETE = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const existing = await getGalleryItem(params.id);
    await deleteGalleryItem(params.id);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.GALLERY_DELETED,
        resourceType: "gallery_item",
        resourceId: params.id,
        description: `Deleted gallery item "${existing.title}"`,
      },
      audit,
    );
    return ok({ deleted: true });
  },
});
