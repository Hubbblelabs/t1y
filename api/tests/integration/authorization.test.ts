import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { Principal } from "@/lib/auth/session";
import type { UserRole } from "@/generated/prisma/enums";
import {
  accessibleStudyIds,
  canExportResearchData,
  canViewParticipant,
  canViewParticipantHealthData,
  canViewStudy,
  exportableStudyIds,
  participantScopeFilter,
} from "@/lib/permissions/policies";

/**
 * Authorisation against the seeded development database.
 *
 * The unit tests prove the role matrix is correct in the abstract. These prove
 * the resource-scoped rules hold against real rows — in particular that a
 * researcher cannot reach a participant who is not enrolled in one of their
 * studies, which is the property that actually protects participant privacy.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

function principalFor(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): Principal {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: "ACTIVE",
    emailVerified: true,
    timezone: "UTC",
    sessionId: "test-session",
  };
}

let researcher: Principal;
let admin: Principal;
let superAdmin: Principal;
let reviewer: Principal;
let patient: Principal;

let studyId: string;
/** A participant enrolled in the researcher's study. */
let enrolledParticipantId: string;
/** A participant who is not enrolled in any study. */
let unenrolledParticipantId: string;

beforeAll(async () => {
  const byRole = async (role: UserRole) => {
    const user = await prisma.user.findFirst({
      where: { role },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new Error(`Seed data is missing a ${role} user.`);
    return principalFor(user);
  };

  [researcher, admin, superAdmin, reviewer, patient] = await Promise.all([
    byRole("RESEARCHER"),
    byRole("ADMIN"),
    byRole("SUPER_ADMIN"),
    byRole("CLINICAL_REVIEWER"),
    byRole("PATIENT"),
  ]);

  const grant = await prisma.studyAccess.findFirst({
    where: { userId: researcher.userId },
    select: { studyId: true },
  });
  if (!grant) throw new Error("Seed data is missing a study access grant.");
  studyId = grant.studyId;

  const enrolled = await prisma.studyParticipant.findFirst({
    where: { studyId, enrollmentStatus: { in: ["ENROLLED", "ACTIVE", "COMPLETED"] } },
    select: { userId: true },
  });
  if (!enrolled) throw new Error("Seed data is missing an enrolled participant.");
  enrolledParticipantId = enrolled.userId;

  const unenrolled = await prisma.user.findFirst({
    where: { role: "PATIENT", studyEnrollments: { none: {} } },
    select: { id: true },
  });
  if (!unenrolled) throw new Error("Seed data is missing an unenrolled participant.");
  unenrolledParticipantId = unenrolled.id;
});

describe("researcher scoping", () => {
  it("sees only the studies they were granted", async () => {
    const ids = await accessibleStudyIds(researcher);
    expect(ids).toContain(studyId);

    const allStudies = await prisma.researchStudy.count();
    const grantCount = await prisma.studyAccess.count({
      where: { userId: researcher.userId },
    });
    expect(ids).toHaveLength(grantCount);
    expect(ids.length).toBeLessThanOrEqual(allStudies);
  });

  it("may view a participant enrolled in their study", async () => {
    expect(await canViewParticipant(researcher, enrolledParticipantId)).toBe(true);
  });

  it("may NOT view a participant outside their studies", async () => {
    expect(await canViewParticipant(researcher, unenrolledParticipantId)).toBe(false);
  });

  it("may NOT read health data for a participant outside their studies", async () => {
    expect(
      await canViewParticipantHealthData(researcher, unenrolledParticipantId),
    ).toBe(false);
  });

  it("produces a query filter that excludes unenrolled participants", async () => {
    const filter = await participantScopeFilter(researcher);

    const visible = await prisma.user.findMany({
      where: { role: "PATIENT", ...filter },
      select: { id: true },
    });
    const visibleIds = visible.map((row) => row.id);

    expect(visibleIds).toContain(enrolledParticipantId);
    expect(visibleIds).not.toContain(unenrolledParticipantId);
  });

  it("scopes the filter to fewer participants than exist in total", async () => {
    const filter = await participantScopeFilter(researcher);
    const scoped = await prisma.user.count({ where: { role: "PATIENT", ...filter } });
    const total = await prisma.user.count({ where: { role: "PATIENT" } });

    expect(scoped).toBeGreaterThan(0);
    expect(scoped).toBeLessThan(total);
  });

  it("may view its own study but not an arbitrary one", async () => {
    expect(await canViewStudy(researcher, studyId)).toBe(true);
    expect(await canViewStudy(researcher, "does-not-exist")).toBe(false);
  });
});

describe("participant scoping", () => {
  it("restricts a patient to their own record", async () => {
    const filter = await participantScopeFilter(patient);
    expect(filter).toEqual({ id: patient.userId });

    const visible = await prisma.user.findMany({ where: filter, select: { id: true } });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(patient.userId);
  });

  it("lets a patient read their own data", async () => {
    expect(await canViewParticipant(patient, patient.userId)).toBe(true);
    expect(await canViewParticipantHealthData(patient, patient.userId)).toBe(true);
  });

  it("stops a patient reading anyone else's data", async () => {
    expect(await canViewParticipant(patient, enrolledParticipantId)).toBe(false);
    expect(await canViewParticipantHealthData(patient, enrolledParticipantId)).toBe(
      false,
    );
  });
});

describe("staff scoping", () => {
  it("does not restrict administrators", async () => {
    expect(await participantScopeFilter(admin)).toEqual({});
    expect(await canViewParticipant(admin, unenrolledParticipantId)).toBe(true);
  });

  it("does not restrict clinical reviewers from reading health data", async () => {
    expect(await participantScopeFilter(reviewer)).toEqual({});
    expect(await canViewParticipantHealthData(reviewer, unenrolledParticipantId)).toBe(
      true,
    );
  });

  it("gives a clinical reviewer no export rights", async () => {
    expect(await canExportResearchData(reviewer)).toBe(false);
    expect(await exportableStudyIds(reviewer)).toEqual([]);
  });

  it("lets a super administrator export any study", async () => {
    expect(await canExportResearchData(superAdmin, studyId)).toBe(true);
  });
});

describe("export authorisation", () => {
  it("permits a researcher to export only where the grant allows it", async () => {
    const grant = await prisma.studyAccess.findUnique({
      where: { studyId_userId: { studyId, userId: researcher.userId } },
      select: { canExport: true },
    });

    const allowed = await canExportResearchData(researcher, studyId);
    expect(allowed).toBe(grant?.canExport ?? false);
  });

  it("refuses a researcher export for a study they cannot see", async () => {
    expect(await canExportResearchData(researcher, "does-not-exist")).toBe(false);
  });

  it("never lets a patient export research data", async () => {
    expect(await canExportResearchData(patient)).toBe(false);
    expect(await exportableStudyIds(patient)).toEqual([]);
  });
});
