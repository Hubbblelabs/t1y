import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listActiveProfileFieldDefinitions } from "@/lib/services/profile-fields";

/**
 * GET /api/profile-fields — the admin-defined fields a signed-in parent
 * should currently be shown on the profile-edit form, in display order.
 * Only `active` fields; a retired one simply stops appearing here, and any
 * answer already on file for it is untouched.
 */
export const GET = defineRoute({
  handler: async () => ok(await listActiveProfileFieldDefinitions()),
});
