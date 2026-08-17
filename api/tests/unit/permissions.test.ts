import { describe, expect, it } from "vitest";

import {
  Capability,
  capabilitiesFor,
  isStaffRole,
  roleHas,
  STAFF_ROLES,
} from "@/lib/permissions/roles";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * The role/capability matrix.
 *
 * These assertions encode the access rules from the requirements. If a change
 * to the matrix breaks one of them, that change needs a deliberate decision —
 * not a test update.
 */
describe("role capability matrix", () => {
  describe("PATIENT", () => {
    it("holds no administrative capability whatsoever", () => {
      expect(capabilitiesFor("PATIENT")).toEqual([]);
    });

    it("cannot reach the admin area", () => {
      expect(roleHas("PATIENT", Capability.ADMIN_AREA_ACCESS)).toBe(false);
    });

    it("cannot view other participants", () => {
      expect(roleHas("PATIENT", Capability.PARTICIPANTS_VIEW)).toBe(false);
      expect(roleHas("PATIENT", Capability.HEALTH_DATA_VIEW)).toBe(false);
    });
  });

  describe("RESEARCHER", () => {
    it("may view participants and approved research data", () => {
      expect(roleHas("RESEARCHER", Capability.PARTICIPANTS_VIEW)).toBe(true);
      expect(roleHas("RESEARCHER", Capability.RESEARCH_VIEW)).toBe(true);
      expect(roleHas("RESEARCHER", Capability.HEALTH_DATA_VIEW)).toBe(true);
    });

    it("may not manage system administrators", () => {
      expect(roleHas("RESEARCHER", Capability.ADMINS_MANAGE)).toBe(false);
    });

    it("may not edit participants or manage content", () => {
      expect(roleHas("RESEARCHER", Capability.PARTICIPANTS_EDIT)).toBe(false);
      expect(roleHas("RESEARCHER", Capability.EDUCATION_MANAGE)).toBe(false);
      expect(roleHas("RESEARCHER", Capability.EXERCISE_CONTENT_MANAGE)).toBe(false);
    });

    it("may not read the audit trail", () => {
      expect(roleHas("RESEARCHER", Capability.AUDIT_VIEW)).toBe(false);
    });
  });

  describe("ADMIN", () => {
    it("may manage participants, content and messaging", () => {
      expect(roleHas("ADMIN", Capability.PARTICIPANTS_EDIT)).toBe(true);
      expect(roleHas("ADMIN", Capability.EDUCATION_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.NOTIFICATIONS_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.HEALTH_DATA_VIEW)).toBe(true);
    });

    it("may not manage staff accounts or platform settings", () => {
      expect(roleHas("ADMIN", Capability.ADMINS_MANAGE)).toBe(false);
      expect(roleHas("ADMIN", Capability.SETTINGS_MANAGE)).toBe(false);
    });

    it("may not toggle feature flags — two of them gate clinical dose calculators", () => {
      expect(roleHas("ADMIN", Capability.FEATURE_FLAGS_MANAGE)).toBe(false);
    });

    it("may not define clinical thresholds", () => {
      // Threshold authorship belongs to clinical reviewers and super admins.
      expect(roleHas("ADMIN", Capability.THRESHOLDS_MANAGE)).toBe(false);
    });
  });

  describe("CLINICAL_REVIEWER", () => {
    it("has read access to participant health data", () => {
      expect(roleHas("CLINICAL_REVIEWER", Capability.HEALTH_DATA_VIEW)).toBe(true);
      expect(roleHas("CLINICAL_REVIEWER", Capability.PARTICIPANTS_VIEW)).toBe(true);
    });

    it("owns clinical thresholds", () => {
      expect(roleHas("CLINICAL_REVIEWER", Capability.THRESHOLDS_MANAGE)).toBe(true);
    });

    it("cannot modify participants, content or staff", () => {
      expect(roleHas("CLINICAL_REVIEWER", Capability.PARTICIPANTS_EDIT)).toBe(false);
      expect(roleHas("CLINICAL_REVIEWER", Capability.EDUCATION_MANAGE)).toBe(false);
      expect(roleHas("CLINICAL_REVIEWER", Capability.ADMINS_MANAGE)).toBe(false);
    });

    it("cannot export research datasets", () => {
      expect(roleHas("CLINICAL_REVIEWER", Capability.RESEARCH_EXPORT)).toBe(false);
    });
  });

  describe("SUPER_ADMIN", () => {
    it("holds every defined capability", () => {
      const all = Object.values(Capability);
      const held = capabilitiesFor("SUPER_ADMIN");
      expect([...held].sort()).toEqual([...all].sort());
    });
  });

  describe("staff classification", () => {
    it("treats every non-patient role as staff", () => {
      expect(isStaffRole("PATIENT")).toBe(false);
      for (const role of STAFF_ROLES) {
        expect(isStaffRole(role)).toBe(true);
      }
    });
  });

  describe("invariants across all roles", () => {
    const roles: UserRole[] = [
      "PATIENT",
      "ADMIN",
      "SUPER_ADMIN",
      "RESEARCHER",
      "CLINICAL_REVIEWER",
    ];

    it("grants staff-account management to the super administrator only", () => {
      const holders = roles.filter((role) =>
        roleHas(role, Capability.ADMINS_MANAGE),
      );
      expect(holders).toEqual(["SUPER_ADMIN"]);
    });

    it("grants audit export to the super administrator only", () => {
      const holders = roles.filter((role) => roleHas(role, Capability.AUDIT_EXPORT));
      expect(holders).toEqual(["SUPER_ADMIN"]);
    });

    it("never grants a capability that implies admin access without granting it", () => {
      for (const role of roles) {
        const held = capabilitiesFor(role);
        if (held.length === 0) continue;
        expect(held).toContain(Capability.ADMIN_AREA_ACCESS);
      }
    });
  });
});
