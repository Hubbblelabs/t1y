import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

/**
 * Clinician-configured thresholds.
 *
 * The platform ships with no built-in notion of a "normal" or "target" value.
 * Any range shown to a participant or an administrator originates here, was
 * entered by an authorised clinical reviewer or super administrator, and
 * carries a `source` recording the guideline it came from.
 *
 * Resolution order is most-specific-first: a threshold set for an individual
 * participant overrides one set for their study, which overrides the global
 * default.
 */

const THRESHOLD_SELECT = {
  id: true,
  key: true,
  scope: true,
  studyId: true,
  userId: true,
  domain: true,
  context: true,
  definitionId: true,
  unit: true,
  lowValue: true,
  highValue: true,
  label: true,
  source: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicalThresholdSelect;

export type ResolvedThreshold = Prisma.ClinicalThresholdGetPayload<{
  select: typeof THRESHOLD_SELECT;
}>;

/**
 * Thresholds that apply to a participant, with more specific scopes shadowing
 * broader ones by `key`.
 */
export async function resolveThresholdsForParticipant(
  userId: string,
): Promise<ResolvedThreshold[]> {
  const enrollments = await prisma.studyParticipant.findMany({
    where: { userId, enrollmentStatus: { in: ["ENROLLED", "ACTIVE"] } },
    select: { studyId: true },
  });
  const studyIds = enrollments.map((enrollment) => enrollment.studyId);

  const candidates = await prisma.clinicalThreshold.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: "GLOBAL" },
        ...(studyIds.length ? [{ scope: "STUDY" as const, studyId: { in: studyIds } }] : []),
        { scope: "PARTICIPANT" as const, userId },
      ],
    },
    select: THRESHOLD_SELECT,
  });

  const precedence = { GLOBAL: 0, STUDY: 1, PARTICIPANT: 2 } as const;
  const winners = new Map<string, ResolvedThreshold>();

  for (const candidate of candidates) {
    const existing = winners.get(candidate.key);
    if (!existing || precedence[candidate.scope] > precedence[existing.scope]) {
      winners.set(candidate.key, candidate);
    }
  }

  return [...winners.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function listThresholds(params: {
  domain?: string;
  scope?: "GLOBAL" | "STUDY" | "PARTICIPANT";
  studyId?: string;
  includeInactive?: boolean;
}) {
  return prisma.clinicalThreshold.findMany({
    where: {
      ...(params.domain ? { domain: params.domain } : {}),
      ...(params.scope ? { scope: params.scope } : {}),
      ...(params.studyId ? { studyId: params.studyId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    select: THRESHOLD_SELECT,
    orderBy: [{ domain: "asc" }, { key: "asc" }],
  });
}

export interface ThresholdInput {
  key: string;
  scope: "GLOBAL" | "STUDY" | "PARTICIPANT";
  studyId?: string | null;
  userId?: string | null;
  domain: string;
  context?: string | null;
  definitionId?: string | null;
  unit: string;
  lowValue?: number | null;
  highValue?: number | null;
  label: string;
  /** Provenance is mandatory — a threshold with no stated origin is not usable. */
  source: string;
  isActive?: boolean;
}

export async function createThreshold(createdById: string, input: ThresholdInput) {
  return prisma.clinicalThreshold.create({
    data: { ...input, createdById },
    select: THRESHOLD_SELECT,
  });
}

export async function updateThreshold(id: string, input: Partial<ThresholdInput>) {
  const existing = await prisma.clinicalThreshold.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Threshold");

  return prisma.clinicalThreshold.update({
    where: { id },
    data: input,
    select: THRESHOLD_SELECT,
  });
}

export async function deleteThreshold(id: string): Promise<void> {
  await prisma.clinicalThreshold.delete({ where: { id } });
}

/**
 * Classifies a value against a threshold.
 *
 * Returns `"unclassified"` when no threshold is configured — the caller must
 * then present the number without judgement rather than assuming a default.
 */
export type Classification = "below" | "within" | "above" | "unclassified";

export function classify(
  value: number | null | undefined,
  threshold: Pick<ResolvedThreshold, "lowValue" | "highValue"> | null | undefined,
): Classification {
  if (value === null || value === undefined || !threshold) return "unclassified";
  if (threshold.lowValue === null && threshold.highValue === null) return "unclassified";
  if (threshold.lowValue !== null && value < threshold.lowValue) return "below";
  if (threshold.highValue !== null && value > threshold.highValue) return "above";
  return "within";
}
