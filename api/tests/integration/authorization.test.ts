import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { Principal } from "@/lib/auth/session";
import type { UserRole } from "@/generated/prisma/enums";
import {
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
 * The unit tests prove the role matrix is correct in the abstract. This
 * proves the resource-scoped rules hold against real rows.
 *
 * This deployment has one staff role (ADMIN) rather than the platform's
 * original SUPER_ADMIN/RESEARCHER/CLINICAL_REVIEWER split — see
 * lib/permissions/roles.ts. There is no researcher-scoped-to-their-studies
 * behaviour left to test: ADMIN sees and can export everything, and the
 * property that actually matters here is the one that still exists —
 * a patient is confined to their own record.
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

let admin: Principal;
let patient: Principal;
let otherPatientId: string;

/** A throwaway study, created and torn down here — this deployment's real
 *  database has none seeded (see prisma/seed.ts), since the platform's
 *  research-study scaffolding is unused by this study's actual workflow. */
let studyId: string;

beforeAll(async () => {
  const byRole = async (role: UserRole) => {
    const user = await prisma.user.findFirst({
      where: { role },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new Error(`Seed data is missing a ${role} user.`);
    return principalFor(user);
  };

  [admin, patient] = await Promise.all([byRole("ADMIN"), byRole("PATIENT")]);

  const other = await prisma.user.findFirst({
    where: { role: "PATIENT", id: { not: patient.userId } },
    select: { id: true },
  });
  if (!other) throw new Error("Seed data needs at least two PATIENT users.");
  otherPatientId = other.id;

  const study = await prisma.researchStudy.create({
    data: {
      code: `AUTHTEST-${Date.now()}`,
      title: "Authorization test fixture",
      status: "ACTIVE",
      dataPoints: [],
      createdById: admin.userId,
    },
    select: { id: true },
  });
  studyId = study.id;
});

afterAll(async () => {
  if (studyId) await prisma.researchStudy.delete({ where: { id: studyId } }).catch(() => {});
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
    expect(await canViewParticipant(patient, otherPatientId)).toBe(false);
    expect(await canViewParticipantHealthData(patient, otherPatientId)).toBe(false);
  });
});

describe("staff scoping", () => {
  it("does not restrict the administrator to a subset of participants", async () => {
    expect(await participantScopeFilter(admin)).toEqual({});
    expect(await canViewParticipant(admin, otherPatientId)).toBe(true);
    expect(await canViewParticipantHealthData(admin, otherPatientId)).toBe(true);
  });

  it("lets the administrator view and export any study", async () => {
    expect(await canViewStudy(admin, studyId)).toBe(true);
    expect(await canExportResearchData(admin, studyId)).toBe(true);
  });

  it("refuses a study that doesn't exist", async () => {
    expect(await canViewStudy(admin, "does-not-exist")).toBe(false);
    expect(await canExportResearchData(admin, "does-not-exist")).toBe(false);
  });
});

describe("export authorisation", () => {
  it("never lets a patient export research data", async () => {
    expect(await canExportResearchData(patient)).toBe(false);
    expect(await exportableStudyIds(patient)).toEqual([]);
  });
});
