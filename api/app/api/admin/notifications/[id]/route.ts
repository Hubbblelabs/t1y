import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { getCampaign, updateCampaign } from "@/lib/services/notifications";
import { idParamSchema } from "@/lib/validation/common";
import { updateCampaignSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getCampaign(params.id)),
});

export const PATCH = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateCampaignSchema,
  handler: async ({ params, body }) => ok(await updateCampaign(params.id, body)),
});
