import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listGalleryForApp } from "@/lib/services/gallery";

/** GET /api/gallery — the pictures and videos shown in the app's Gallery. */
export const GET = defineRoute({
  handler: async () => ok(await listGalleryForApp()),
});
