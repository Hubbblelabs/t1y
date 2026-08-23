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
 * This deployment serves one study with one operating team — ADMIN is the
 * only staff role, holding the union of every capability the platform's
 * original SUPER_ADMIN/RESEARCHER/CLINICAL_REVIEWER split used to divide up
 * (see lib/permissions/roles.ts). These assertions encode that: a change to
 * the matrix breaking one of them needs a deliberate decision, not a test
 * update.
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

  describe("ADMIN", () => {
    it("holds every defined capability — the only staff role", () => {
      const all = Object.values(Capability);
      const held = capabilitiesFor("ADMIN");
      expect([...held].sort()).toEqual([...all].sort());
    });

    it("may manage participants, content and messaging", () => {
      expect(roleHas("ADMIN", Capability.PARTICIPANTS_EDIT)).toBe(true);
      expect(roleHas("ADMIN", Capability.EDUCATION_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.NOTIFICATIONS_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.HEALTH_DATA_VIEW)).toBe(true);
    });

    it("may manage staff accounts, settings and thresholds", () => {
      expect(roleHas("ADMIN", Capability.ADMINS_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.SETTINGS_MANAGE)).toBe(true);
      expect(roleHas("ADMIN", Capability.THRESHOLDS_MANAGE)).toBe(true);
    });

    it("may toggle feature flags — including the clinical-safety-gated ones", () => {
      expect(roleHas("ADMIN", Capability.FEATURE_FLAGS_MANAGE)).toBe(true);
    });

    it("may view and export the audit trail", () => {
      expect(roleHas("ADMIN", Capability.AUDIT_VIEW)).toBe(true);
      expect(roleHas("ADMIN", Capability.AUDIT_EXPORT)).toBe(true);
    });
  });

  describe("staff classification", () => {
    it("treats ADMIN as staff and PATIENT as not", () => {
      expect(isStaffRole("PATIENT")).toBe(false);
      for (const role of STAFF_ROLES) {
        expect(isStaffRole(role)).toBe(true);
      }
    });
  });

  describe("invariants across all roles", () => {
    const roles: UserRole[] = ["PATIENT", "ADMIN"];

    it("grants staff-account management to ADMIN only", () => {
      const holders = roles.filter((role) => roleHas(role, Capability.ADMINS_MANAGE));
      expect(holders).toEqual(["ADMIN"]);
    });

    it("grants audit export to ADMIN only", () => {
      const holders = roles.filter((role) => roleHas(role, Capability.AUDIT_EXPORT));
      expect(holders).toEqual(["ADMIN"]);
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
