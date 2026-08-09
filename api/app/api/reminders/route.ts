import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { createReminder, listReminders } from "@/lib/services/notifications";
import { createReminderSchema } from "@/lib/validation/health";

/**
 * Reminder schedules.
 *
 * The backend owns recurrence and the next firing time so the rules stay
 * consistent across devices; the mobile application only renders and receives.
 */

export const GET = defineRoute({
  handler: async ({ principal }) => ok(await listReminders(principal.userId)),
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: createReminderSchema,
  handler: async ({ principal, body }) =>
    created(await createReminder(principal.userId, body)),
});
