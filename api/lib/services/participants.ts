import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { DiabetesType, UserStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { getLatestHbA1cForParticipants } from "@/lib/services/hba1c";
import { getAdherenceForParticipants } from "@/lib/services/medications";

/**
 * Participant directory and profiles.
 *
 * Every query runs through `participantScopeFilter`, so a researcher's list is
 * narrowed in SQL to the studies they hold access to — an unauthorised row is
 * never loaded, not merely hidden.
 *
 * The list view is deliberately server-paginated. Health history grows without
 * bound and the participant table must never pull the whole cohort into the
 * browser.
 */

export type ParticipantSortField =
  | "name"
  | "participantCode"
  | "createdAt"
  | "lastActivityAt"
  | "diabetesType"
  | "status";

export interface ParticipantListParams {
  search?: string;
  status?: UserStatus[];
  diabetesType?: DiabetesType[];
  studyId?: string;
  joinedFrom?: Date;
  joinedTo?: Date;
  sortBy: ParticipantSortField;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
  /** Window used for the adherence column. */
  adherenceFrom: Date;
  adherenceTo: Date;
}

export interface ParticipantRow {
  id: string;
  participantCode: string;
  name: string;
  email: string;
  diabetesType: DiabetesType;
  status: UserStatus;
  lastActivityAt: Date | null;
  lastGlucoseAt: Date | null;
  latestHbA1c: { valuePercent: number; measuredAt: Date } | null;
  adherencePercent: number | null;
  createdAt: Date;
  studyCount: number;
}

export async function listParticipants(
  principal: Principal,
  params: ParticipantListParams,
): Promise<{ items: ParticipantRow[]; total: number }> {
  const scope = await participantScopeFilter(principal);

  const where: Prisma.UserWhereInput = {
    ...scope,
    role: "PATIENT",
    deletedAt: null,
    ...(params.status?.length ? { status: { in: params.status } } : {}),
    ...(params.joinedFrom || params.joinedTo
      ? {
          createdAt: {
            ...(params.joinedFrom ? { gte: params.joinedFrom } : {}),
            ...(params.joinedTo ? { lte: params.joinedTo } : {}),
          },
        }
      : {}),
    ...(params.diabetesType?.length
      ? { profile: { diabetesType: { in: params.diabetesType } } }
      : {}),
    ...(params.studyId
      ? { studyEnrollments: { some: { studyId: params.studyId } } }
      : {}),
    ...(params.search ? buildSearchFilter(params.search) : {}),
  };

  const orderBy = buildOrderBy(params.sortBy, params.sortOrder);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            participantCode: true,
            firstName: true,
            lastName: true,
            diabetesType: true,
            lastActivityAt: true,
          },
        },
        _count: { select: { studyEnrollments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((user) => user.id);

  // Three grouped queries for the whole page, rather than N queries per row.
  const [adherence, hba1c, lastGlucose] = await Promise.all([
    getAdherenceForParticipants({
      userIds,
      from: params.adherenceFrom,
      to: params.adherenceTo,
    }),
    getLatestHbA1cForParticipants(userIds),
    getLastGlucoseAtForParticipants(userIds),
  ]);

  const items: ParticipantRow[] = users.map((user) => ({
    id: user.id,
    participantCode: user.profile?.participantCode ?? "—",
    name: user.profile
      ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
      : user.name,
    email: user.email,
    diabetesType: user.profile?.diabetesType ?? "UNSPECIFIED",
    status: user.status,
    lastActivityAt: user.profile?.lastActivityAt ?? null,
    lastGlucoseAt: lastGlucose.get(user.id) ?? null,
    latestHbA1c: hba1c.get(user.id) ?? null,
    adherencePercent: adherence.get(user.id) ?? null,
    createdAt: user.createdAt,
    studyCount: user._count.studyEnrollments,
  }));

  return { items, total };
}

function buildSearchFilter(search: string): Prisma.UserWhereInput {
  const term = search.trim();
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { profile: { participantCode: { contains: term, mode: "insensitive" } } },
      { profile: { firstName: { contains: term, mode: "insensitive" } } },
      { profile: { lastName: { contains: term, mode: "insensitive" } } },
    ],
  };
}

function buildOrderBy(
  sortBy: ParticipantSortField,
  sortOrder: "asc" | "desc",
): Prisma.UserOrderByWithRelationInput {
  switch (sortBy) {
    case "name":
      return { profile: { lastName: sortOrder } };
    case "participantCode":
      return { profile: { participantCode: sortOrder } };
    case "diabetesType":
      return { profile: { diabetesType: sortOrder } };
    case "lastActivityAt":
      // Participants who have never logged sort last on a descending sort.
      return { profile: { lastActivityAt: { sort: sortOrder, nulls: "last" } } };
    case "status":
      return { status: sortOrder };
    case "createdAt":
    default:
      return { createdAt: sortOrder };
  }
}

async function getLastGlucoseAtForParticipants(
  userIds: string[],
): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<Array<{ userId: string; measuredAt: Date }>>`
    SELECT DISTINCT ON ("userId") "userId", "measuredAt"
    FROM "GlucoseReading"
    WHERE "userId" = ANY(${userIds})
    ORDER BY "userId", "measuredAt" DESC
  `;

  return new Map(rows.map((row) => [row.userId, row.measuredAt]));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getParticipantProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "PATIENT", deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      status: true,
      timezone: true,
      locale: true,
      lastLoginAt: true,
      createdAt: true,
      profile: {
        select: {
          participantCode: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          sex: true,
          phone: true,
          city: true,
          country: true,
          diabetesType: true,
          diagnosisYear: true,
          treatmentModality: true,
          heightCm: true,
          baselineWeightKg: true,
          primaryClinician: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          onboardedAt: true,
          lastActivityAt: true,
        },
      },
      studyEnrollments: {
        select: {
          id: true,
          studyParticipantCode: true,
          enrollmentStatus: true,
          armOrGroup: true,
          enrolledAt: true,
          withdrawnAt: true,
          study: { select: { id: true, code: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          glucoseReadings: true,
          medications: true,
          insulinLogs: true,
          meals: true,
          exerciseLogs: true,
          hba1cRecords: true,
          healthMetrics: true,
        },
      },
    },
  });

  if (!user) throw new NotFoundError("Participant");
  return user;
}

export interface UpdateParticipantInput {
  status?: UserStatus;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    diabetesType?: DiabetesType;
    diagnosisYear?: number | null;
    treatmentModality?: Prisma.ProfileUpdateInput["treatmentModality"];
    heightCm?: number | null;
    baselineWeightKg?: number | null;
    primaryClinician?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
}

export async function updateParticipant(userId: string, input: UpdateParticipantInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.profile ? { profile: { update: input.profile } } : {}),
    },
    select: { id: true, status: true },
  });
}

export interface CreateParticipantInput {
  email: string;
  firstName: string;
  lastName: string;
  participantCode?: string;
  diabetesType?: DiabetesType;
  diagnosisYear?: number;
  phone?: string;
  timezone?: string;
}

/**
 * Creates a participant record without credentials.
 *
 * The account is left `PENDING` with no password; the participant completes
 * sign-up through the normal verification flow. Administrators never set
 * another person's password.
 */
export async function createParticipant(input: CreateParticipantInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true },
  });
  if (existing) throw new ConflictError("An account with this email already exists.");

  const participantCode = input.participantCode ?? (await nextParticipantCode());

  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: `${input.firstName} ${input.lastName}`.trim(),
      role: "PATIENT",
      status: "PENDING",
      timezone: input.timezone ?? "UTC",
      profile: {
        create: {
          participantCode,
          firstName: input.firstName,
          lastName: input.lastName,
          diabetesType: input.diabetesType ?? "UNSPECIFIED",
          diagnosisYear: input.diagnosisYear,
          phone: input.phone,
        },
      },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { participantCode: true } },
    },
  });
}

/**
 * Allocates the next sequential participant code (P0001, P0002 …).
 *
 * Derived from the highest existing code rather than a row count, so deleting
 * a participant cannot cause a collision.
 */
export async function nextParticipantCode(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(NULLIF(REGEXP_REPLACE("participantCode", '\\D', '', 'g'), '')::int) AS max
    FROM "Profile"
    WHERE "participantCode" ~ '^P[0-9]+$'
  `;

  const next = (rows[0]?.max ?? 0) + 1;
  return `P${String(next).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  id: string;
  kind: "glucose" | "medication" | "insulin" | "meal" | "exercise" | "hba1c" | "metric";
  occurredAt: Date;
  summary: string;
  detail?: string;
}

/**
 * A merged, reverse-chronological activity feed for one participant.
 *
 * Each source contributes at most `limit` rows and the merge happens in
 * application code — cheaper and clearer than a seven-way SQL union, given the
 * per-table indexes on (userId, timestamp).
 */
export async function getParticipantTimeline(params: {
  userId: string;
  from: Date;
  to: Date;
  limit: number;
}): Promise<TimelineEntry[]> {
  const { userId, from, to, limit } = params;
  const window = { gte: from, lte: to };

  const [glucose, medications, insulin, meals, exercise, hba1c, metrics] =
    await Promise.all([
      prisma.glucoseReading.findMany({
        where: { userId, measuredAt: window },
        orderBy: { measuredAt: "desc" },
        take: limit,
        select: { id: true, value: true, unit: true, context: true, measuredAt: true },
      }),
      prisma.medicationLog.findMany({
        where: { userId, OR: [{ scheduledFor: window }, { takenAt: window }] },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          takenAt: true,
          createdAt: true,
          medication: { select: { name: true } },
        },
      }),
      prisma.insulinLog.findMany({
        where: { userId, administeredAt: window },
        orderBy: { administeredAt: "desc" },
        take: limit,
        select: {
          id: true,
          insulinName: true,
          doseUnits: true,
          unit: true,
          administeredAt: true,
        },
      }),
      prisma.meal.findMany({
        where: { userId, consumedAt: window },
        orderBy: { consumedAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          mealType: true,
          totalCarbsGrams: true,
          consumedAt: true,
        },
      }),
      prisma.exerciseLog.findMany({
        where: { userId, performedAt: window },
        orderBy: { performedAt: "desc" },
        take: limit,
        select: {
          id: true,
          activityName: true,
          durationMinutes: true,
          intensity: true,
          performedAt: true,
        },
      }),
      prisma.hbA1cRecord.findMany({
        where: { userId, measuredAt: window },
        orderBy: { measuredAt: "desc" },
        take: limit,
        select: { id: true, valuePercent: true, measuredAt: true },
      }),
      prisma.healthMetric.findMany({
        where: { userId, measuredAt: window },
        orderBy: { measuredAt: "desc" },
        take: limit,
        select: {
          id: true,
          value: true,
          secondaryValue: true,
          unit: true,
          measuredAt: true,
          definition: { select: { label: true, valueType: true } },
        },
      }),
    ]);

  const entries: TimelineEntry[] = [
    ...glucose.map((row) => ({
      id: `glucose:${row.id}`,
      kind: "glucose" as const,
      occurredAt: row.measuredAt,
      summary: "Glucose logged",
      detail: `${row.value} ${row.unit === "MG_DL" ? "mg/dL" : "mmol/L"} · ${humanise(row.context)}`,
    })),
    ...medications.map((row) => ({
      id: `medication:${row.id}`,
      kind: "medication" as const,
      occurredAt: row.takenAt ?? row.scheduledFor ?? row.createdAt,
      summary: "Medication",
      detail: `${row.medication.name} — ${humanise(row.status)}`,
    })),
    ...insulin.map((row) => ({
      id: `insulin:${row.id}`,
      kind: "insulin" as const,
      occurredAt: row.administeredAt,
      summary: "Insulin recorded",
      detail: `${row.insulinName} — ${row.doseUnits} ${row.unit}`,
    })),
    ...meals.map((row) => ({
      id: `meal:${row.id}`,
      kind: "meal" as const,
      occurredAt: row.consumedAt,
      summary: humanise(row.mealType),
      detail: [row.name, row.totalCarbsGrams ? `${row.totalCarbsGrams} g carbohydrate` : null]
        .filter(Boolean)
        .join(" · "),
    })),
    ...exercise.map((row) => ({
      id: `exercise:${row.id}`,
      kind: "exercise" as const,
      occurredAt: row.performedAt,
      summary: "Exercise",
      detail: `${row.activityName} — ${row.durationMinutes} minutes · ${humanise(row.intensity)}`,
    })),
    ...hba1c.map((row) => ({
      id: `hba1c:${row.id}`,
      kind: "hba1c" as const,
      occurredAt: row.measuredAt,
      summary: "HbA1c",
      detail: `${row.valuePercent}%`,
    })),
    ...metrics.map((row) => ({
      id: `metric:${row.id}`,
      kind: "metric" as const,
      occurredAt: row.measuredAt,
      summary: row.definition.label,
      detail:
        row.definition.valueType === "COMPOSITE" && row.secondaryValue !== null
          ? `${row.value}/${row.secondaryValue} ${row.unit}`
          : `${row.value ?? "—"} ${row.unit}`,
    })),
  ];

  return entries
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

/** "PRE_MEAL" → "Pre meal" */
function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
