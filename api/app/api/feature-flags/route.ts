import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPublicFeatureFlags } from "@/lib/services/feature-flags";

/**
 * `auth: "optional"` (not "public", not "required") — the splash screen
 * needs to know `content_lang_ta_enabled` before sign-in, but a signed-in
 * caller gets the identical response. No capability check: a separate
 * PATIENT-readable model is the whole reason FeatureFlag exists instead of
 * riding on SystemSetting (SUPER_ADMIN-only).
 */
export const GET = defineRoute({
  auth: "optional",
  requireVerifiedEmail: false,
  handler: async () => ok(await getPublicFeatureFlags()),
});
