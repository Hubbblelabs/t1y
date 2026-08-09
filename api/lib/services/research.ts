import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { EnrollmentStatus, StudyStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { accessibleStudyIds } from "@/lib/permissions/policies";
import { round } from "@/lib/services/shared";

/** Research studies, enrolment and cohort analytics. */

const STUDY_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  objective: true,
  status: true,
  principalInvestigator: true,
  irbNumber: true,
  consentVersion: true,
  startDate: true,
  endDate: true,
  targetEnrollment: true,
  dataPoints: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  _count: { select: { participants: true, access: true } },
} satisfies Prisma.ResearchStudySelect;

export async function listStudies(
  principal: Principal,
  params: { status?: StudyStatus; search?: string; skip: number; take: number },
) {
  // Researchers see only the studies they have been granted access to.
  const allowedIds = await accessibleStudyIds(principal);

  const where: Prisma.ResearchStudyWhereInput = {
    id: { in: allowedIds },
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { code: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.researchStudy.findMany({
      where,
      select: STUDY_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.researchStudy.count({ where }),
  ]);

  return { items, total };
}

export async function getStudy(id: string) {
  const study = await prisma.researchStudy.findUnique({
    where: { id },
    select: STUDY_SELECT,
  });
  if (!study) throw new NotFoundError("Study");
  return study;
}

export interface StudyInput {
  code: string;
  title: string;
  description?: string;
  objective?: string;
  status?: StudyStatus;
  principalInvestigator?: string;
  irbNumber?: string;
  consentVersion?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  targetEnrollment?: number | null;
  dataPoints?: string[];
}

export async function createStudy(createdById: string, input: StudyInput) {
  const existing = await prisma.researchStudy.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (existing) throw new ConflictError("A study with this code already exists.");

  return prisma.researchStudy.create({
    data: { ...input, dataPoints: input.dataPoints ?? [], createdById },
    select: STUDY_SELECT,
  });
}

export async function updateStudy(id: string, input: Partial<StudyInput>) {
  return prisma.researchStudy.update({
    where: { id },
    data: input,
    select: STUDY_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

const ENROLLMENT_SELECT = {
  id: true,
  studyParticipantCode: true,
  enrollmentStatus: true,
  armOrGroup: true,
  consentGivenAt: true,
  enrolledAt: true,
  withdrawnAt: true,
  withdrawalReason: true,
  notes: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: {
        select: {
          participantCode: true,
          firstName: true,
          lastName: true,
          diabetesType: true,
          lastActivityAt: true,
        },
      },
    },
  },
} satisfies Prisma.StudyParticipantSelect;

export async function listStudyParticipants(params: {
  studyId: string;
  enrollmentStatus?: EnrollmentStatus;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.StudyParticipantWhereInput = {
    studyId: params.studyId,
    ...(params.enrollmentStatus ? { enrollmentStatus: params.enrollmentStatus } : {}),
    ...(params.search
      ? {
          OR: [
            { studyParticipantCode: { contains: params.search, mode: "insensitive" } },
            {
              user: {
                profile: {
                  participantCode: { contains: params.search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.studyParticipant.findMany({
      where,
      select: ENROLLMENT_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.studyParticipant.count({ where }),
  ]);

  return { items, total };
}

export async function enrollParticipant(params: {
  studyId: string;
  userId: string;
  studyParticipantCode?: string;
  armOrGroup?: string;
  consentGivenAt?: Date;
  notes?: string;
}) {
  const [study, user, existing] = await Promise.all([
    prisma.researchStudy.findUnique({
      where: { id: params.studyId },
      select: { id: true, code: true, status: true },
    }),
    prisma.user.findFirst({
      where: { id: params.userId, role: "PATIENT", deletedAt: null },
      select: { id: true },
    }),
    prisma.studyParticipant.findUnique({
      where: { studyId_userId: { studyId: params.studyId, userId: params.userId } },
      select: { id: true },
    }),
  ]);

  if (!study) throw new NotFoundError("Study");
  if (!user) throw new NotFoundError("Participant");
  if (existing) throw new ConflictError("This participant is already enrolled.");
  if (study.status === "COMPLETED" || study.status === "ARCHIVED") {
    throw new ValidationError("This study is no longer accepting participants.");
  }

  const code =
    params.studyParticipantCode ?? (await nextStudyParticipantCode(study.id, study.code));

  return prisma.studyParticipant.create({
    data: {
      studyId: params.studyId,
      userId: params.userId,
      studyParticipantCode: code,
      armOrGroup: params.armOrGroup,
      consentGivenAt: params.consentGivenAt,
      notes: params.notes,
      enrollmentStatus: params.consentGivenAt ? "ENROLLED" : "INVITED",
      enrolledAt: params.consentGivenAt ? new Date() : null,
    },
    select: ENROLLMENT_SELECT,
  });
}

/** Sequential per-study pseudonym, e.g. "DM01-0007". */
async function nextStudyParticipantCode(
  studyId: string,
  studyCode: string,
): Promise<string> {
  const count = await prisma.studyParticipant.count({ where: { studyId } });
  return `${studyCode}-${String(count + 1).padStart(4, "0")}`;
}

export async function updateEnrollment(
  id: string,
  input: {
    enrollmentStatus?: EnrollmentStatus;
    armOrGroup?: string | null;
    consentGivenAt?: Date | null;
    withdrawalReason?: string | null;
    notes?: string | null;
  },
) {
  const data: Prisma.StudyParticipantUpdateInput = { ...input };

  if (input.enrollmentStatus === "WITHDRAWN") {
    data.withdrawnAt = new Date();
  }
  if (input.enrollmentStatus === "ENROLLED" || input.enrollmentStatus === "ACTIVE") {
    data.enrolledAt = new Date();
    data.withdrawnAt = null;
  }

  return prisma.studyParticipant.update({
    where: { id },
    data,
    select: ENROLLMENT_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

export async function listStudyAccess(studyId: string) {
  return prisma.studyAccess.findMany({
    where: { studyId },
    select: {
      id: true,
      role: true,
      canExport: true,
      grantedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { grantedAt: "desc" },
  });
}

export async function grantStudyAccess(params: {
  studyId: string;
  userId: string;
  role: "LEAD_INVESTIGATOR" | "ANALYST" | "VIEWER";
  canExport: boolean;
  grantedById: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { role: true },
  });
  if (!user) throw new NotFoundError("User");

  // Only staff roles can hold study access; a participant never can.
  if (user.role === "PATIENT") {
    throw new ValidationError("Study access can only be granted to staff accounts.");
  }

  return prisma.studyAccess.upsert({
    where: { studyId_userId: { studyId: params.studyId, userId: params.userId } },
    create: {
      studyId: params.studyId,
      userId: params.userId,
      role: params.role,
      canExport: params.canExport,
      grantedById: params.grantedById,
    },
    update: { role: params.role, canExport: params.canExport },
    select: {
      id: true,
      role: true,
      canExport: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function revokeStudyAccess(studyId: string, userId: string): Promise<void> {
  await prisma.studyAccess.deleteMany({ where: { studyId, userId } });
}

// ---------------------------------------------------------------------------
// Study analytics
// ---------------------------------------------------------------------------

export interface StudyAnalytics {
  enrollment: {
    total: number;
    byStatus: Array<{ status: EnrollmentStatus; count: number }>;
    targetEnrollment: number | null;
    progressPercent: number | null;
  };
  dataCompleteness: Array<{
    domain: string;
    participantsWithData: number;
    totalParticipants: number;
    completenessPercent: number;
    recordCount: number;
  }>;
  measurementFrequency: {
    glucoseReadingsPerParticipantPerDay: number | null;
    daysObserved: number;
  };
  adherencePercent: number | null;
}

/**
 * Cohort-level metrics for one study.
 *
 * "Data completeness" is the share of enrolled participants who contributed at
 * least one record in each domain during the window — a data-quality measure,
 * not a clinical one.
 */
export async function getStudyAnalytics(params: {
  studyId: string;
  from: Date;
  to: Date;
}): Promise<StudyAnalytics> {
  const [study, enrollments, byStatus] = await Promise.all([
    prisma.researchStudy.findUnique({
      where: { id: params.studyId },
      select: { targetEnrollment: true },
    }),
    prisma.studyParticipant.findMany({
      where: {
        studyId: params.studyId,
        enrollmentStatus: { in: ["ENROLLED", "ACTIVE", "COMPLETED"] },
      },
      select: { userId: true },
    }),
    prisma.studyParticipant.groupBy({
      by: ["enrollmentStatus"],
      where: { studyId: params.studyId },
      _count: { _all: true },
    }),
  ]);

  const userIds = enrollments.map((enrollment) => enrollment.userId);
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);

  const completeness =
    userIds.length > 0
      ? await getDataCompleteness(userIds, params.from, params.to)
      : [];

  const daysObserved = Math.max(
    1,
    Math.round((params.to.getTime() - params.from.getTime()) / 86_400_000),
  );

  const glucoseRecords =
    completeness.find((row) => row.domain === "glucose")?.recordCount ?? 0;

  const adherence =
    userIds.length > 0
      ? await prisma.medicationLog.groupBy({
          by: ["status"],
          where: {
            userId: { in: userIds },
            OR: [
              { scheduledFor: { gte: params.from, lte: params.to } },
              { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
            ],
          },
          _count: { _all: true },
        })
      : [];

  const taken = adherence.find((row) => row.status === "TAKEN")?._count._all ?? 0;
  const resolved = adherence
    .filter((row) => row.status !== "PENDING")
    .reduce((sum, row) => sum + row._count._all, 0);

  return {
    enrollment: {
      total,
      byStatus: byStatus.map((row) => ({
        status: row.enrollmentStatus,
        count: row._count._all,
      })),
      targetEnrollment: study?.targetEnrollment ?? null,
      progressPercent:
        study?.targetEnrollment && study.targetEnrollment > 0
          ? round((userIds.length / study.targetEnrollment) * 100, 1)
          : null,
    },
    dataCompleteness: completeness,
    measurementFrequency: {
      glucoseReadingsPerParticipantPerDay:
        userIds.length > 0
          ? round(glucoseRecords / userIds.length / daysObserved, 2)
          : null,
      daysObserved,
    },
    adherencePercent: resolved > 0 ? round((taken / resolved) * 100, 1) : null,
  };
}

async function getDataCompleteness(userIds: string[], from: Date, to: Date) {
  const scope = { in: userIds };
  const window = { gte: from, lte: to };

  // Each domain groups by participant, so the row count is "participants with
  // at least one record" and the summed count is the total record volume.
  const [glucose, medication, insulin, nutrition, exercise, hba1c, metrics] =
    await Promise.all([
      prisma.glucoseReading.groupBy({
        by: ["userId"],
        where: { userId: scope, measuredAt: window },
        _count: { _all: true },
      }),
      prisma.medicationLog.groupBy({
        by: ["userId"],
        where: { userId: scope, createdAt: window },
        _count: { _all: true },
      }),
      prisma.insulinLog.groupBy({
        by: ["userId"],
        where: { userId: scope, administeredAt: window },
        _count: { _all: true },
      }),
      prisma.meal.groupBy({
        by: ["userId"],
        where: { userId: scope, consumedAt: window },
        _count: { _all: true },
      }),
      prisma.exerciseLog.groupBy({
        by: ["userId"],
        where: { userId: scope, performedAt: window },
        _count: { _all: true },
      }),
      prisma.hbA1cRecord.groupBy({
        by: ["userId"],
        where: { userId: scope, measuredAt: window },
        _count: { _all: true },
      }),
      prisma.healthMetric.groupBy({
        by: ["userId"],
        where: { userId: scope, measuredAt: window },
        _count: { _all: true },
      }),
    ]);

  const summarise = (
    domain: string,
    rows: Array<{ _count: { _all: number } }>,
  ) => ({
    domain,
    participantsWithData: rows.length,
    totalParticipants: userIds.length,
    completenessPercent: round((rows.length / userIds.length) * 100, 1) ?? 0,
    recordCount: rows.reduce((sum, row) => sum + row._count._all, 0),
  });

  return [
    summarise("glucose", glucose),
    summarise("medication", medication),
    summarise("insulin", insulin),
    summarise("nutrition", nutrition),
    summarise("exercise", exercise),
    summarise("hba1c", hba1c),
    summarise("health-metrics", metrics),
  ];
}
