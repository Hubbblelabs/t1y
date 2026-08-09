import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { MedicationLogStatus } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { round, touchParticipantActivity, TRUNC_UNIT, type TrendInterval } from "@/lib/services/shared";

/**
 * Medications and adherence.
 *
 * Adherence is defined as taken ÷ (taken + missed + skipped). Doses still
 * `PENDING` are excluded — a dose that has not come due yet is neither adhered
 * to nor missed, and counting it would understate every participant's rate.
 */

const MEDICATION_SELECT = {
  id: true,
  name: true,
  genericName: true,
  dosageText: true,
  form: true,
  route: true,
  frequency: true,
  timesPerDay: true,
  scheduleTimes: true,
  instructions: true,
  prescribedBy: true,
  reason: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicationSelect;

const LOG_SELECT = {
  id: true,
  medicationId: true,
  scheduledFor: true,
  takenAt: true,
  status: true,
  doseAmount: true,
  doseUnit: true,
  notes: true,
  createdAt: true,
  medication: { select: { id: true, name: true, dosageText: true } },
} satisfies Prisma.MedicationLogSelect;

export async function listMedications(params: {
  userId: string;
  activeOnly?: boolean;
  skip: number;
  take: number;
}) {
  const where: Prisma.MedicationWhereInput = {
    userId: params.userId,
    ...(params.activeOnly ? { isActive: true } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.medication.findMany({
      where,
      select: MEDICATION_SELECT,
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.medication.count({ where }),
  ]);

  return { items, total };
}

export async function getMedication(id: string) {
  const medication = await prisma.medication.findUnique({
    where: { id },
    select: { ...MEDICATION_SELECT, userId: true },
  });
  if (!medication) throw new NotFoundError("Medication");
  return medication;
}

export async function createMedication(
  userId: string,
  input: Omit<Prisma.MedicationUncheckedCreateInput, "userId" | "id">,
) {
  const medication = await prisma.medication.create({
    data: { ...input, userId },
    select: MEDICATION_SELECT,
  });
  await touchParticipantActivity(userId);
  return medication;
}

export async function updateMedication(
  id: string,
  input: Prisma.MedicationUpdateInput,
) {
  return prisma.medication.update({
    where: { id },
    data: input,
    select: MEDICATION_SELECT,
  });
}

/**
 * Medications are discontinued rather than deleted — their historical logs are
 * part of the adherence record and must survive.
 */
export async function discontinueMedication(id: string, endDate: Date) {
  return prisma.medication.update({
    where: { id },
    data: { isActive: false, endDate },
    select: MEDICATION_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export async function listMedicationLogs(params: {
  userId: string;
  from: Date;
  to: Date;
  medicationId?: string;
  status?: MedicationLogStatus;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.MedicationLogWhereInput = {
    userId: params.userId,
    ...(params.medicationId ? { medicationId: params.medicationId } : {}),
    ...(params.status ? { status: params.status } : {}),
    OR: [
      { scheduledFor: { gte: params.from, lte: params.to } },
      { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.medicationLog.findMany({
      where,
      select: LOG_SELECT,
      orderBy: [{ scheduledFor: params.sortOrder }, { createdAt: params.sortOrder }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.medicationLog.count({ where }),
  ]);

  return { items, total };
}

export interface CreateMedicationLogInput {
  medicationId: string;
  status: MedicationLogStatus;
  scheduledFor?: Date;
  takenAt?: Date;
  doseAmount?: number;
  doseUnit?: string;
  notes?: string;
}

/**
 * Records a dose. Re-logging the same scheduled slot updates the existing entry
 * instead of failing, which is what a participant correcting a mistake expects.
 */
export async function recordMedicationLog(
  userId: string,
  input: CreateMedicationLogInput,
) {
  const medication = await prisma.medication.findUnique({
    where: { id: input.medicationId },
    select: { id: true, userId: true },
  });

  if (!medication) throw new NotFoundError("Medication");
  if (medication.userId !== userId) {
    // Surfaced as "not found" so the endpoint does not confirm the id exists.
    throw new NotFoundError("Medication");
  }

  const log = input.scheduledFor
    ? await prisma.medicationLog.upsert({
        where: {
          medicationId_scheduledFor: {
            medicationId: input.medicationId,
            scheduledFor: input.scheduledFor,
          },
        },
        create: { ...input, userId },
        update: {
          status: input.status,
          takenAt: input.takenAt ?? null,
          doseAmount: input.doseAmount ?? null,
          doseUnit: input.doseUnit ?? null,
          notes: input.notes ?? null,
        },
        select: LOG_SELECT,
      })
    : await prisma.medicationLog.create({
        data: { ...input, userId },
        select: LOG_SELECT,
      });

  await touchParticipantActivity(userId);
  return log;
}

export async function deleteMedicationLog(id: string): Promise<void> {
  await prisma.medicationLog.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Adherence
// ---------------------------------------------------------------------------

export interface AdherenceSummary {
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  /** Doses that have come due: taken + missed + skipped. */
  resolved: number;
  /** taken ÷ resolved, as a percentage. Null when nothing has come due. */
  adherencePercent: number | null;
}

export async function getAdherenceSummary(params: {
  userId?: string;
  userIds?: string[];
  medicationId?: string;
  from: Date;
  to: Date;
}): Promise<AdherenceSummary> {
  if (params.userIds && params.userIds.length === 0) {
    return emptyAdherence();
  }

  const where: Prisma.MedicationLogWhereInput = {
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.userIds ? { userId: { in: params.userIds } } : {}),
    ...(params.medicationId ? { medicationId: params.medicationId } : {}),
    OR: [
      { scheduledFor: { gte: params.from, lte: params.to } },
      { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
    ],
  };

  const grouped = await prisma.medicationLog.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
  return summariseCounts({
    taken: counts.get("TAKEN") ?? 0,
    missed: counts.get("MISSED") ?? 0,
    skipped: counts.get("SKIPPED") ?? 0,
    pending: counts.get("PENDING") ?? 0,
  });
}

function summariseCounts(counts: {
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}): AdherenceSummary {
  const resolved = counts.taken + counts.missed + counts.skipped;
  return {
    ...counts,
    resolved,
    adherencePercent: resolved > 0 ? round((counts.taken / resolved) * 100, 1) : null,
  };
}

function emptyAdherence(): AdherenceSummary {
  return {
    taken: 0,
    missed: 0,
    skipped: 0,
    pending: 0,
    resolved: 0,
    adherencePercent: null,
  };
}

/** Adherence per medication, for the participant detail view. */
export async function getAdherenceByMedication(params: {
  userId: string;
  from: Date;
  to: Date;
}) {
  const rows = await prisma.medicationLog.groupBy({
    by: ["medicationId", "status"],
    where: {
      userId: params.userId,
      OR: [
        { scheduledFor: { gte: params.from, lte: params.to } },
        { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
      ],
    },
    _count: { _all: true },
  });

  const byMedication = new Map<
    string,
    { taken: number; missed: number; skipped: number; pending: number }
  >();

  for (const row of rows) {
    const entry = byMedication.get(row.medicationId) ?? {
      taken: 0,
      missed: 0,
      skipped: 0,
      pending: 0,
    };
    if (row.status === "TAKEN") entry.taken += row._count._all;
    if (row.status === "MISSED") entry.missed += row._count._all;
    if (row.status === "SKIPPED") entry.skipped += row._count._all;
    if (row.status === "PENDING") entry.pending += row._count._all;
    byMedication.set(row.medicationId, entry);
  }

  if (byMedication.size === 0) return [];

  const medications = await prisma.medication.findMany({
    where: { id: { in: [...byMedication.keys()] } },
    select: { id: true, name: true, dosageText: true, isActive: true },
  });

  return medications.map((medication) => ({
    medication,
    ...summariseCounts(byMedication.get(medication.id)!),
  }));
}

/** Adherence over time, for the trend chart. */
export async function getAdherenceTrend(params: {
  userId?: string;
  userIds?: string[];
  from: Date;
  to: Date;
  interval: TrendInterval;
}): Promise<Array<{ bucket: string; taken: number; resolved: number; adherencePercent: number | null }>> {
  if (params.userIds && params.userIds.length === 0) return [];

  const truncUnit = Prisma.raw(`'${TRUNC_UNIT[params.interval]}'`);
  const scope = params.userId
    ? Prisma.sql`AND "userId" = ${params.userId}`
    : params.userIds
      ? Prisma.sql`AND "userId" IN (${Prisma.join(params.userIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; taken: bigint; resolved: bigint }>
  >`
    SELECT
      DATE_TRUNC(${truncUnit}, COALESCE("scheduledFor", "createdAt")) AS bucket,
      COUNT(*) FILTER (WHERE "status" = 'TAKEN')::bigint              AS taken,
      COUNT(*) FILTER (WHERE "status" <> 'PENDING')::bigint           AS resolved
    FROM "MedicationLog"
    WHERE COALESCE("scheduledFor", "createdAt") >= ${params.from}
      AND COALESCE("scheduledFor", "createdAt") <= ${params.to}
      ${scope}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return rows.map((row) => {
    const taken = Number(row.taken);
    const resolved = Number(row.resolved);
    return {
      bucket: row.bucket.toISOString(),
      taken,
      resolved,
      adherencePercent: resolved > 0 ? round((taken / resolved) * 100, 1) : null,
    };
  });
}

/** Adherence for many participants at once, for the participant table. */
export async function getAdherenceForParticipants(params: {
  userIds: string[];
  from: Date;
  to: Date;
}): Promise<Map<string, number | null>> {
  if (params.userIds.length === 0) return new Map();

  const rows = await prisma.medicationLog.groupBy({
    by: ["userId", "status"],
    where: {
      userId: { in: params.userIds },
      OR: [
        { scheduledFor: { gte: params.from, lte: params.to } },
        { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
      ],
    },
    _count: { _all: true },
  });

  const tally = new Map<string, { taken: number; resolved: number }>();
  for (const row of rows) {
    if (row.status === "PENDING") continue;
    const entry = tally.get(row.userId) ?? { taken: 0, resolved: 0 };
    entry.resolved += row._count._all;
    if (row.status === "TAKEN") entry.taken += row._count._all;
    tally.set(row.userId, entry);
  }

  const result = new Map<string, number | null>();
  for (const userId of params.userIds) {
    const entry = tally.get(userId);
    result.set(
      userId,
      entry && entry.resolved > 0 ? round((entry.taken / entry.resolved) * 100, 1) : null,
    );
  }
  return result;
}

/**
 * Materialises `PENDING` rows for doses that have come due, so that a dose the
 * participant never interacted with is counted as scheduled rather than
 * vanishing. Invoked by the daily cron.
 */
export async function generatePendingDoses(now: Date, lookbackHours = 24) {
  const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const medications = await prisma.medication.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: windowStart } }],
      NOT: { scheduleTimes: { isEmpty: true } },
    },
    select: {
      id: true,
      userId: true,
      scheduleTimes: true,
      user: { select: { timezone: true } },
    },
  });

  let created = 0;

  for (const medication of medications) {
    for (const time of medication.scheduleTimes) {
      const scheduledFor = resolveScheduledInstant(time, medication.user.timezone, now);
      if (!scheduledFor || scheduledFor < windowStart || scheduledFor > now) continue;

      try {
        await prisma.medicationLog.create({
          data: {
            userId: medication.userId,
            medicationId: medication.id,
            scheduledFor,
            status: "PENDING",
          },
        });
        created += 1;
      } catch (error) {
        // A unique-constraint violation just means the dose is already logged.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  return { created, medicationsChecked: medications.length };
}

/**
 * Resolves "08:00 in the participant's timezone, on the day of `reference`"
 * into an absolute instant.
 */
function resolveScheduledInstant(
  timeOfDay: string,
  timezone: string,
  reference: Date,
): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeOfDay);
  if (!match) return null;

  const [hours, minutes] = [Number(match[1]), Number(match[2])];

  try {
    // Determine the calendar date in the participant's timezone.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(reference);

    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const localDate = `${get("year")}-${get("month")}-${get("day")}`;

    // Find the UTC instant whose local representation is that date and time.
    const guess = new Date(`${localDate}T${timeOfDay}:00Z`);
    const offsetMs = timezoneOffsetMs(guess, timezone);
    return new Date(guess.getTime() - offsetMs);
  } catch {
    return null;
  }
}

/** Offset of `timezone` from UTC at `instant`, in milliseconds. */
function timezoneOffsetMs(instant: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(instant);
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
