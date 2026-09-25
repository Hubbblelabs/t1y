import "server-only";

import { prisma } from "@/lib/db/prisma";
import { isFeatureEnabled } from "@/lib/services/feature-flags";
import { logger } from "@/lib/utils/logger";

/** How long without a reading before a reminder goes out. */
export const GLUCOSE_REMINDER_GAP_HOURS = 6;

/** Never remind more than this often, even if the gap keeps growing. */
const REMIND_AT_MOST_EVERY_HOURS = GLUCOSE_REMINDER_GAP_HOURS;

export interface GlucoseLoggingStatus {
  userId: string;
  name: string;
  participantCode: string | null;
  /** Null when nothing has ever been recorded. */
  lastReadingAt: Date | null;
  hoursSinceLastReading: number | null;
  overdue: boolean;
}

/**
 * Every glucose-eligible, active participant's logging status, for the
 * admin's own visibility — the "admin would be able to check that" half of
 * the reminder feature. Ordered worst-first, so whoever is most overdue is
 * what a coordinator sees first.
 */
export async function listGlucoseLoggingStatus(): Promise<GlucoseLoggingStatus[]> {
  const participants = await prisma.user.findMany({
    where: {
      role: "PATIENT",
      status: "ACTIVE",
      deletedAt: null,
      profile: { enabledFeatures: { has: "GLUCOSE_LOGGING" } },
    },
    select: {
      id: true,
      name: true,
      profile: { select: { participantCode: true } },
      glucoseReadings: {
        orderBy: { measuredAt: "desc" },
        take: 1,
        select: { measuredAt: true },
      },
    },
  });

  const now = Date.now();
  return participants
    .map((participant) => {
      const last = participant.glucoseReadings[0]?.measuredAt ?? null;
      const hours = last ? (now - last.getTime()) / 3_600_000 : null;
      return {
        userId: participant.id,
        name: participant.name,
        participantCode: participant.profile?.participantCode ?? null,
        lastReadingAt: last,
        hoursSinceLastReading: hours,
        overdue: hours === null || hours >= GLUCOSE_REMINDER_GAP_HOURS,
      };
    })
    .sort((a, b) => (b.hoursSinceLastReading ?? Infinity) - (a.hoursSinceLastReading ?? Infinity));
}

/**
 * Notifies every glucose-eligible participant who has gone
 * {@link GLUCOSE_REMINDER_GAP_HOURS} or more without a reading.
 *
 * Runs hourly from /api/cron/glucose-reminders. A participant is skipped if
 * a reminder was already sent within the last {@link REMIND_AT_MOST_EVERY_HOURS}
 * — checked from the notification record itself rather than a separate
 * counter, so there is nothing extra to keep in sync.
 */
export async function sendGlucoseReminders(now = new Date()): Promise<{ sent: number; checked: number }> {
  if (!(await isFeatureEnabled("health_logging_enabled"))) {
    return { sent: 0, checked: 0 };
  }

  const statuses = await listGlucoseLoggingStatus();
  const overdue = statuses.filter((status) => status.overdue);

  const recentlyReminded = await prisma.notification.findMany({
    where: {
      userId: { in: overdue.map((status) => status.userId) },
      type: "GLUCOSE_REMINDER",
      createdAt: { gte: new Date(now.getTime() - REMIND_AT_MOST_EVERY_HOURS * 3_600_000) },
    },
    select: { userId: true },
  });
  const alreadyReminded = new Set(recentlyReminded.map((row) => row.userId));

  const toRemind = overdue.filter((status) => !alreadyReminded.has(status.userId));

  if (toRemind.length > 0) {
    await prisma.notification.createMany({
      data: toRemind.map((status) => ({
        userId: status.userId,
        type: "GLUCOSE_REMINDER" as const,
        title: "Time to check blood glucose",
        body: status.lastReadingAt
          ? "It has been a while since the last reading. A new one keeps the record useful."
          : "No glucose reading has been recorded yet. Add the first one when you can.",
        status: "SENT" as const,
        sentAt: now,
      })),
    });
  }

  logger.info("glucose_reminders.sent", {
    checked: statuses.length,
    overdue: overdue.length,
    sent: toRemind.length,
  });

  return { sent: toRemind.length, checked: statuses.length };
}
