import { assertCronRequest } from "@/lib/api/cron";
import { fromAppError, internalError, ok } from "@/lib/api/response";
import { isAppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { computeNextTrigger } from "@/lib/services/notifications";
import { generatePendingDoses } from "@/lib/services/medications";
import { logger } from "@/lib/utils/logger";
import { captureException } from "@/lib/observability/sentry";

/**
 * Scheduled reminder processing (Vercel Cron, hourly).
 *
 * For every reminder whose next trigger has passed:
 *   1. create the participant-facing notification record,
 *   2. advance `nextTriggerAt` to the following occurrence.
 *
 * Push delivery is the Flutter application's transport concern; this job owns
 * the schedule and the durable record, so the rules stay on the backend.
 *
 * Also materialises `PENDING` medication doses that have come due, so a dose
 * the participant never interacted with is counted rather than lost.
 */

const BATCH_SIZE = 200;

export async function GET(request: Request): Promise<Response> {
  try {
    assertCronRequest(request);

    const now = new Date();

    const due = await prisma.reminder.findMany({
      where: {
        enabled: true,
        nextTriggerAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        timeOfDay: true,
        recurrence: true,
        daysOfWeek: true,
        dayOfMonth: true,
        timezone: true,
        endsAt: true,
      },
    });

    let created = 0;

    for (const reminder of due) {
      const next = computeNextTrigger(reminder, now);

      await prisma.$transaction([
        prisma.notification.create({
          data: {
            userId: reminder.userId,
            type: reminder.type,
            title: reminder.title,
            body: reminder.body ?? reminder.title,
            status: "SENT",
            sentAt: now,
            data: { reminderId: reminder.id },
          },
        }),
        prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            lastTriggeredAt: now,
            nextTriggerAt: next,
            // A non-recurring reminder that has fired is switched off.
            ...(next === null ? { enabled: false } : {}),
          },
        }),
      ]);

      created += 1;
    }

    const doses = await generatePendingDoses(now);

    logger.info("cron.reminders", {
      remindersProcessed: due.length,
      notificationsCreated: created,
      pendingDosesCreated: doses.created,
    });

    return ok({
      remindersProcessed: due.length,
      notificationsCreated: created,
      pendingDosesCreated: doses.created,
      hasMore: due.length === BATCH_SIZE,
    });
  } catch (error) {
    if (isAppError(error)) return fromAppError(error);

    logger.error("cron.reminders_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    captureException(error, { path: "/api/cron/reminders" });
    return internalError();
  }
}
