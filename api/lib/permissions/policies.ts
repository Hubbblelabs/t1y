import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import type { EnrollmentStatus } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/api/errors";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Capability, type CapabilityValue, roleHas } from "@/lib/permissions/roles";

/**
 * Resource-scoped authorisation.
 *
 * Every sensitive endpoint calls one of the `assert*` helpers here. The plain
 * `can*` variants return a boolean and are used by the UI to decide what to
 * render — but the UI is never the enforcement point, the assertions are.
 *
 * Researcher access is the interesting case: holding `PARTICIPANTS_VIEW` is not
 * enough, the participant must also be enrolled in a study the researcher has
 * been granted access to.
 */

// ---------------------------------------------------------------------------
// Capability checks
// ---------------------------------------------------------------------------

export function can(principal: Principal, capability: CapabilityValue): boolean {
  return roleHas(principal.role, capability);
}

export function assertCan(principal: Principal, capability: CapabilityValue): void {
  if (!can(principal, capability)) {
    throw new ForbiddenError();
  }
}

export function canAccessAdminArea(principal: Principal): boolean {
  return can(principal, Capability.ADMIN_AREA_ACCESS);
}

export function canManageEducation(principal: Principal): boolean {
  return can(principal, Capability.EDUCATION_MANAGE);
}

export function canManageExerciseContent(principal: Principal): boolean {
  return can(principal, Capability.EXERCISE_CONTENT_MANAGE);
}

export function canManageAdmins(principal: Principal): boolean {
  return can(principal, Capability.ADMINS_MANAGE);
}

export function canManageNotifications(principal: Principal): boolean {
  return can(principal, Capability.NOTIFICATIONS_MANAGE);
}

export function canViewAuditLogs(principal: Principal): boolean {
  return can(principal, Capability.AUDIT_VIEW);
}

export function canManageSettings(principal: Principal): boolean {
  return can(principal, Capability.SETTINGS_MANAGE);
}

export function canManageThresholds(principal: Principal): boolean {
  return can(principal, Capability.THRESHOLDS_MANAGE);
}

export function canManageStudies(principal: Principal): boolean {
  return can(principal, Capability.RESEARCH_MANAGE_STUDIES);
}

// ---------------------------------------------------------------------------
// Study scoping for researchers
// ---------------------------------------------------------------------------

/**
 * Study IDs a researcher may work with. Cached per request because the
 * participant list, detail page and every export consult it.
 */
export const accessibleStudyIds = cache(
  async (principal: Principal): Promise<string[]> => {
    if (roleHas(principal.role, Capability.RESEARCH_MANAGE_STUDIES)) {
      // Admins and super admins are not restricted to granted studies.
      const all = await prisma.researchStudy.findMany({ select: { id: true } });
      return all.map((study) => study.id);
    }

    const grants = await prisma.studyAccess.findMany({
      where: { userId: principal.userId },
      select: { studyId: true },
    });
    return grants.map((grant) => grant.studyId);
  },
);

/** Study IDs the principal may export data from. */
export async function exportableStudyIds(principal: Principal): Promise<string[]> {
  if (!can(principal, Capability.RESEARCH_EXPORT)) return [];

  if (roleHas(principal.role, Capability.RESEARCH_MANAGE_STUDIES)) {
    return accessibleStudyIds(principal);
  }

  const grants = await prisma.studyAccess.findMany({
    where: { userId: principal.userId, canExport: true },
    select: { studyId: true },
  });
  return grants.map((grant) => grant.studyId);
}

// ---------------------------------------------------------------------------
// Participant-scoped access
// ---------------------------------------------------------------------------

/**
 * A Prisma `where` fragment restricting a participant query to what the
 * principal is allowed to see. Applying this at the query level means an
 * unauthorised row is never loaded in the first place.
 */
export async function participantScopeFilter(
  principal: Principal,
): Promise<Prisma.UserWhereInput> {
  if (principal.role === "PATIENT") {
    return { id: principal.userId };
  }

  if (principal.role === "RESEARCHER") {
    const studyIds = await accessibleStudyIds(principal);
    if (studyIds.length === 0) {
      // No grants: match nothing rather than everything.
      return { id: "__no_access__" };
    }
    return {
      studyEnrollments: {
        some: {
          studyId: { in: studyIds },
          enrollmentStatus: { in: ENROLLED_STATUSES },
        },
      },
    };
  }

  // ADMIN, SUPER_ADMIN and CLINICAL_REVIEWER see all participants.
  return {};
}

/** Enrollment states that make a participant's data visible to a researcher. */
const ENROLLED_STATUSES: EnrollmentStatus[] = ["ENROLLED", "ACTIVE", "COMPLETED"];

export async function canViewParticipant(
  principal: Principal,
  participantUserId: string,
): Promise<boolean> {
  if (principal.userId === participantUserId) return true;
  if (!can(principal, Capability.PARTICIPANTS_VIEW)) return false;

  if (principal.role === "RESEARCHER") {
    const studyIds = await accessibleStudyIds(principal);
    if (studyIds.length === 0) return false;

    const enrollment = await prisma.studyParticipant.findFirst({
      where: {
        userId: participantUserId,
        studyId: { in: studyIds },
        enrollmentStatus: { in: ["ENROLLED", "ACTIVE", "COMPLETED"] },
      },
      select: { id: true },
    });
    return enrollment !== null;
  }

  return true;
}

export async function assertCanViewParticipant(
  principal: Principal,
  participantUserId: string,
): Promise<void> {
  if (!(await canViewParticipant(principal, participantUserId))) {
    throw new ForbiddenError("You do not have access to this participant.");
  }
}

export function canEditParticipant(principal: Principal): boolean {
  return can(principal, Capability.PARTICIPANTS_EDIT);
}

export function assertCanEditParticipant(principal: Principal): void {
  if (!canEditParticipant(principal)) {
    throw new ForbiddenError("You do not have permission to modify participants.");
  }
}

/**
 * Health data access for a specific participant. Read access follows
 * participant visibility; writes are owner-only — staff record-keeping happens
 * through the participant's own account, never on their behalf.
 */
export async function canViewParticipantHealthData(
  principal: Principal,
  participantUserId: string,
): Promise<boolean> {
  if (principal.userId === participantUserId) return true;
  if (!can(principal, Capability.HEALTH_DATA_VIEW)) return false;
  return canViewParticipant(principal, participantUserId);
}

export async function assertCanViewParticipantHealthData(
  principal: Principal,
  participantUserId: string,
): Promise<void> {
  if (!(await canViewParticipantHealthData(principal, participantUserId))) {
    throw new ForbiddenError("You do not have access to this participant's records.");
  }
}

/** Only the participant may create or modify their own health records. */
export function canWriteOwnHealthData(
  principal: Principal,
  targetUserId: string,
): boolean {
  return principal.userId === targetUserId;
}

export function assertOwnsRecord(principal: Principal, ownerUserId: string): void {
  if (principal.userId !== ownerUserId) {
    throw new ForbiddenError("You may only modify your own records.");
  }
}

// ---------------------------------------------------------------------------
// Research data
// ---------------------------------------------------------------------------

export async function canExportResearchData(
  principal: Principal,
  studyId?: string,
): Promise<boolean> {
  if (!can(principal, Capability.RESEARCH_EXPORT)) return false;
  if (!studyId) return true;

  const allowed = await exportableStudyIds(principal);
  return allowed.includes(studyId);
}

export async function assertCanExportResearchData(
  principal: Principal,
  studyId?: string,
): Promise<void> {
  if (!(await canExportResearchData(principal, studyId))) {
    throw new ForbiddenError("You do not have permission to export this dataset.");
  }
}

export async function canViewStudy(
  principal: Principal,
  studyId: string,
): Promise<boolean> {
  if (!can(principal, Capability.RESEARCH_VIEW)) return false;
  const studyIds = await accessibleStudyIds(principal);
  return studyIds.includes(studyId);
}

export async function assertCanViewStudy(
  principal: Principal,
  studyId: string,
): Promise<void> {
  if (!(await canViewStudy(principal, studyId))) {
    throw new ForbiddenError("You do not have access to this study.");
  }
}

// ---------------------------------------------------------------------------
// Staff management
// ---------------------------------------------------------------------------

/**
 * Guards role assignment. Only a super administrator may create or promote
 * staff, and nobody may change their own role.
 */
export function assertCanAssignRole(
  principal: Principal,
  targetUserId: string | null,
): void {
  if (!canManageAdmins(principal)) {
    throw new ForbiddenError("Only a super administrator may manage staff accounts.");
  }
  if (targetUserId && targetUserId === principal.userId) {
    throw new ForbiddenError("You cannot change your own role.");
  }
}
