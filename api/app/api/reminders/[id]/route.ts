import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  deleteReminder,
  getReminder,
  updateReminder,
} from "@/lib/services/notifications";
import { idParamSchema } from "@/lib/validation/common";
import { updateReminderSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const reminder = await getReminder(params.id);
    assertOwnsRecord(principal, reminder.userId);

    const { userId: _ownerId, ...rest } = reminder;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateReminderSchema,
  handler: async ({ principal, params, body }) => {
    const reminder = await getReminder(params.id);
    assertOwnsRecord(principal, reminder.userId);

    return ok(await updateReminder(params.id, body));
  },
});

export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const reminder = await getReminder(params.id);
    assertOwnsRecord(principal, reminder.userId);

    await deleteReminder(params.id);
    return noContent();
  },
});
