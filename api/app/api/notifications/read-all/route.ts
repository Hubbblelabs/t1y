import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { markAllNotificationsRead } from "@/lib/services/notifications";

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  handler: async ({ principal }) => ok(await markAllNotificationsRead(principal.userId)),
});
