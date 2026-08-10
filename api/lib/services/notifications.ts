import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CampaignStatus,
  CampaignTargetType,
  NotificationType,
  UserRole,
} from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

/**
 * Notifications, reminders and campaigns.
 *
 * The backend owns scheduling and eligibility; the Flutter application only
 * displays what it is given and handles the push transport. Business rules
 * therefore live here, not in the mobile client.
 *
 * Notification bodies must not carry specific health values — a push preview
 * appears on a lock screen. `assertNoHealthValues` enforces that on write.
 */

// ---------------------------------------------------------------------------
// Participant-facing
// ---------------------------------------------------------------------------

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  status: true,
  sentAt: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listNotifications(params: {
  userId: string;
  unreadOnly?: boolean;
  skip: number;
  take: number;
}) {
  const where: Prisma.NotificationWhereInput = {
    userId: params.userId,
    ...(params.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: params.userId, readAt: null } }),
  ]);

  return { items, total, unreadCount };
}

export async function markNotificationRead(id: string, userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });

  if (count === 0) {
    // Either it does not exist, belongs to someone else, or was already read.
    const exists = await prisma.notification.findFirst({
      where: { id, userId },
      select: NOTIFICATION_SELECT,
    });
    if (!exists) throw new NotFoundError("Notification");
    return exists;
  }

  return prisma.notification.findUniqueOrThrow({
    where: { id },
    select: NOTIFICATION_SELECT,
  });
}

export async function markAllNotificationsRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });
  return { updated: count };
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const REMINDER_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  timeOfDay: true,
  recurrence: true,
  daysOfWeek: true,
  dayOfMonth: true,
  timezone: true,
  startsAt: true,
  endsAt: true,
  enabled: true,
  medicationId: true,
  lastTriggeredAt: true,
  nextTriggerAt: true,
  createdAt: true,
} satisfies Prisma.ReminderSelect;

export async function listReminders(userId: string) {
  return prisma.reminder.findMany({
    where: { userId },
    select: REMINDER_SELECT,
    orderBy: [{ enabled: "desc" }, { timeOfDay: "asc" }],
  });
}

export async function getReminder(id: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id },
    select: { ...REMINDER_SELECT, userId: true },
  });
  if (!reminder) throw new NotFoundError("Reminder");
  return reminder;
}

export interface CreateReminderInput {
  type: NotificationType;
  title: string;
  body?: string;
  timeOfDay?: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  daysOfWeek: number[];
  dayOfMonth?: number;
  timezone: string;
  startsAt?: Date;
  endsAt?: Date;
  enabled: boolean;
  medicationId?: string;
}

export async function createReminder(userId: string, input: CreateReminderInput) {
  assertNoHealthValues(input.title, input.body);

  if (input.medicationId) {
    const medication = await prisma.medication.findFirst({
      where: { id: input.medicationId, userId },
      select: { id: true },
    });
    if (!medication) throw new NotFoundError("Medication");
  }

  return prisma.reminder.create({
    data: {
      userId,
      ...input,
      nextTriggerAt: computeNextTrigger({ ...input }, new Date()),
    },
    select: REMINDER_SELECT,
  });
}

/** Nullable fields may be cleared, so this is not simply `Partial<CreateReminderInput>`. */
export interface UpdateReminderInput
  extends Partial<Omit<CreateReminderInput, "body" | "dayOfMonth">> {
  body?: string | null;
  dayOfMonth?: number | null;
}

export async function updateReminder(id: string, input: UpdateReminderInput) {
  if (input.title || input.body) assertNoHealthValues(input.title, input.body);

  const current = await prisma.reminder.findUnique({
    where: { id },
    select: {
      recurrence: true,
      timeOfDay: true,
      daysOfWeek: true,
      dayOfMonth: true,
      timezone: true,
      enabled: true,
      endsAt: true,
    },
  });
  if (!current) throw new NotFoundError("Reminder");

  const merged = {
    recurrence: input.recurrence ?? current.recurrence,
    timeOfDay: input.timeOfDay ?? current.timeOfDay ?? undefined,
    daysOfWeek: input.daysOfWeek ?? current.daysOfWeek,
    dayOfMonth: input.dayOfMonth ?? current.dayOfMonth ?? undefined,
    timezone: input.timezone ?? current.timezone,
    enabled: input.enabled ?? current.enabled,
    endsAt: input.endsAt ?? current.endsAt ?? undefined,
  };

  return prisma.reminder.update({
    where: { id },
    data: {
      ...input,
      nextTriggerAt: merged.enabled ? computeNextTrigger(merged, new Date()) : null,
    },
    select: REMINDER_SELECT,
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await prisma.reminder.delete({ where: { id } });
}

/**
 * Next firing instant for a reminder, in UTC.
 *
 * Scans forward day by day (at most 366) rather than doing calendar
 * arithmetic, which keeps weekly/monthly rules and DST transitions correct
 * without special cases.
 */
export function computeNextTrigger(
  reminder: {
    recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
    timeOfDay?: string | null;
    daysOfWeek: number[];
    dayOfMonth?: number | null;
    timezone: string;
    endsAt?: Date | null;
  },
  from: Date,
): Date | null {
  if (reminder.recurrence === "NONE" || !reminder.timeOfDay) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(reminder.timeOfDay);
  if (!match) return null;

  for (let dayOffset = 0; dayOffset <= 366; dayOffset += 1) {
    const probe = new Date(from.getTime() + dayOffset * 86_400_000);
    const local = localParts(probe, reminder.timezone);
    if (!local) return null;

    if (reminder.recurrence === "WEEKLY") {
      // Stored as ISO weekdays (1 = Monday, 7 = Sunday).
      const isoWeekday = local.weekday === 0 ? 7 : local.weekday;
      if (!reminder.daysOfWeek.includes(isoWeekday)) continue;
    }

    if (reminder.recurrence === "MONTHLY" && local.day !== reminder.dayOfMonth) {
      continue;
    }

    const candidate = instantFromLocal(local, reminder.timeOfDay, reminder.timezone);
    if (!candidate || candidate <= from) continue;
    if (reminder.endsAt && candidate > reminder.endsAt) return null;
    return candidate;
  }

  return null;
}

function localParts(instant: Date, timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const parts = formatter.formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return {
      year: get("year"),
      month: get("month"),
      day: Number(get("day")),
      weekday: weekdayNames.indexOf(get("weekday")),
    };
  } catch {
    return null;
  }
}

function instantFromLocal(
  local: { year: string; month: string; day: number },
  timeOfDay: string,
  timezone: string,
): Date | null {
  const dayString = String(local.day).padStart(2, "0");
  const guess = new Date(`${local.year}-${local.month}-${dayString}T${timeOfDay}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;

  const offsetMs = timezoneOffsetMs(guess, timezone);
  return new Date(guess.getTime() - offsetMs);
}

function timezoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Rejects notification copy that embeds a measurement.
 *
 * A push preview is visible without unlocking the device, so "Your glucose was
 * 243 mg/dL" is a disclosure. Reminders should say what to do, not what the
 * numbers are.
 */
/**
 * The trailing assertion is `(?!\w)` rather than `\b`: a word boundary cannot
 * match after a non-word character, so `\b` silently failed to catch units
 * like `%` — "Latest HbA1c: 9.8%" would have passed straight through.
 */
const HEALTH_VALUE_PATTERN =
  /\b\d{1,4}(?:\.\d+)?\s?(?:mg\/dl|mmol\/l|mmol|%|units?|iu|kg|lbs?|bpm|mmhg)(?!\w)/i;

export function assertNoHealthValues(...texts: Array<string | null | undefined>): void {
  for (const text of texts) {
    if (text && HEALTH_VALUE_PATTERN.test(text)) {
      throw new ValidationError(
        "Notification text must not contain specific health values, because previews appear on lock screens.",
        [{ field: "body", message: "Remove the measurement from this message." }],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Campaigns (administration)
// ---------------------------------------------------------------------------

const CAMPAIGN_SELECT = {
  id: true,
  title: true,
  body: true,
  type: true,
  status: true,
  targetType: true,
  targetRole: true,
  targetStudyId: true,
  targetUserIds: true,
  scheduledAt: true,
  sentAt: true,
  cancelledAt: true,
  totalRecipients: true,
  deliveredCount: true,
  failedCount: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  targetStudy: { select: { id: true, code: true, title: true } },
} satisfies Prisma.NotificationCampaignSelect;

export async function listCampaigns(params: {
  status?: CampaignStatus;
  type?: NotificationType;
  skip: number;
  take: number;
}) {
  const where: Prisma.NotificationCampaignWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.type ? { type: params.type } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notificationCampaign.findMany({
      where,
      select: CAMPAIGN_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.notificationCampaign.count({ where }),
  ]);

  return { items, total };
}

export async function getCampaign(id: string) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: CAMPAIGN_SELECT,
  });
  if (!campaign) throw new NotFoundError("Notification");
  return campaign;
}

export interface CampaignInput {
  title: string;
  body: string;
  type: NotificationType;
  targetType: CampaignTargetType;
  targetRole?: UserRole;
  targetStudyId?: string;
  targetUserIds?: string[];
  scheduledAt?: Date;
}

export async function createCampaign(createdById: string, input: CampaignInput) {
  assertNoHealthValues(input.title, input.body);
  validateTarget(input);

  const recipients = await resolveRecipientIds(input);

  return prisma.notificationCampaign.create({
    data: {
      ...input,
      targetUserIds: input.targetUserIds ?? [],
      status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
      totalRecipients: recipients.length,
      createdById,
    },
    select: CAMPAIGN_SELECT,
  });
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!campaign) throw new NotFoundError("Notification");
  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    throw new ConflictError("A notification that has been sent cannot be edited.");
  }

  if (input.title || input.body) assertNoHealthValues(input.title, input.body);

  return prisma.notificationCampaign.update({
    where: { id },
    data: {
      ...input,
      ...(input.scheduledAt ? { status: "SCHEDULED" } : {}),
    },
    select: CAMPAIGN_SELECT,
  });
}

export async function cancelCampaign(id: string, cancelledById: string) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!campaign) throw new NotFoundError("Notification");
  if (campaign.status === "SENT") {
    throw new ConflictError("This notification has already been sent.");
  }
  if (campaign.status === "CANCELLED") {
    throw new ConflictError("This notification is already cancelled.");
  }

  return prisma.notificationCampaign.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById },
    select: CAMPAIGN_SELECT,
  });
}

function validateTarget(input: Partial<CampaignInput>): void {
  if (input.targetType === "STUDY" && !input.targetStudyId) {
    throw new ValidationError("Select the study to notify.", [
      { field: "targetStudyId", message: "A study is required." },
    ]);
  }
  if (input.targetType === "ROLE" && !input.targetRole) {
    throw new ValidationError("Select the role to notify.", [
      { field: "targetRole", message: "A role is required." },
    ]);
  }
  if (
    input.targetType === "SPECIFIC_USERS" &&
    (!input.targetUserIds || input.targetUserIds.length === 0)
  ) {
    throw new ValidationError("Select at least one recipient.", [
      { field: "targetUserIds", message: "At least one recipient is required." },
    ]);
  }
}

/** Resolves a campaign's audience to concrete, eligible user ids. */
export async function resolveRecipientIds(input: {
  targetType: CampaignTargetType;
  targetRole?: UserRole | null;
  targetStudyId?: string | null;
  targetUserIds?: string[];
}): Promise<string[]> {
  // Suspended, inactive and soft-deleted accounts never receive messages.
  const base: Prisma.UserWhereInput = { status: "ACTIVE", deletedAt: null };

  switch (input.targetType) {
    case "ALL_PARTICIPANTS": {
      const users = await prisma.user.findMany({
        where: { ...base, role: "PATIENT" },
        select: { id: true },
      });
      return users.map((user) => user.id);
    }
    case "ROLE": {
      if (!input.targetRole) return [];
      const users = await prisma.user.findMany({
        where: { ...base, role: input.targetRole },
        select: { id: true },
      });
      return users.map((user) => user.id);
    }
    case "STUDY": {
      if (!input.targetStudyId) return [];
      const enrollments = await prisma.studyParticipant.findMany({
        where: {
          studyId: input.targetStudyId,
          enrollmentStatus: { in: ["ENROLLED", "ACTIVE"] },
          user: base,
        },
        select: { userId: true },
      });
      return enrollments.map((enrollment) => enrollment.userId);
    }
    case "SPECIFIC_USERS": {
      if (!input.targetUserIds?.length) return [];
      const users = await prisma.user.findMany({
        where: { ...base, id: { in: input.targetUserIds } },
        select: { id: true },
      });
      return users.map((user) => user.id);
    }
  }
}

/**
 * Fans a campaign out into per-participant notification rows.
 *
 * Actual push delivery is the Flutter application's transport concern; this
 * creates the durable records the device fetches and the dashboard reports on.
 */
export async function dispatchCampaign(campaignId: string) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      status: true,
      targetType: true,
      targetRole: true,
      targetStudyId: true,
      targetUserIds: true,
    },
  });
  if (!campaign) throw new NotFoundError("Notification");
  if (campaign.status === "SENT" || campaign.status === "CANCELLED") {
    return { sent: 0, alreadyProcessed: true };
  }

  const recipientIds = await resolveRecipientIds(campaign);

  await prisma.notificationCampaign.update({
    where: { id: campaignId },
    data: { status: "SENDING", totalRecipients: recipientIds.length },
  });

  const now = new Date();
  const { count } = await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      campaignId,
      type: campaign.type,
      title: campaign.title,
      body: campaign.body,
      status: "SENT" as const,
      sentAt: now,
    })),
    skipDuplicates: true,
  });

  await prisma.notificationCampaign.update({
    where: { id: campaignId },
    data: { status: "SENT", sentAt: now, deliveredCount: count },
  });

  return { sent: count, alreadyProcessed: false };
}

/** Campaigns whose scheduled time has arrived. Used by the cron endpoint. */
export async function findDueCampaigns(now: Date) {
  return prisma.notificationCampaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
    take: 50,
  });
}
