import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createPresignedUpload } from "@/lib/storage/r2";
import { uploadRequestSchema } from "@/lib/validation/admin";

/**
 * POST /api/admin/uploads
 *
 * Issues a short-lived presigned PUT URL so the browser uploads media straight
 * to Cloudflare R2. Bytes never traverse a Vercel function, which is what makes
 * multi-hundred-megabyte exercise videos feasible on a serverless platform.
 *
 * The response's `key` is what the caller stores against the content record
 * once the upload succeeds.
 */
export const POST = defineRoute({
  capability: Capability.STORAGE_UPLOAD,
  rateLimit: RateLimits.adminWrite,
  body: uploadRequestSchema,
  handler: async ({ principal, body, audit }) => {
    const upload = await createPresignedUpload({
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      filename: body.filename,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.UPLOAD_URL_ISSUED,
        resourceType: "media-asset",
        resourceId: upload.key,
        description: `Issued upload URL for ${body.purpose}`,
        metadata: {
          purpose: body.purpose,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
        },
      },
      audit,
    );

    return ok(upload);
  },
});
