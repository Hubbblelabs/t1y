import type { UserRole } from "@/generated/prisma/enums";

/**
 * Capability catalogue.
 *
 * Authorisation is expressed as capabilities rather than role comparisons
 * scattered through the codebase. A route asks "may this principal do X?", and
 * this file is the only place that answers.
 *
 * Capabilities that depend on a specific resource (which participant? which
 * study?) are additionally narrowed by the resource-scoped guards in
 * `policies.ts` — holding the capability is necessary but not always sufficient.
 */
export const Capability = {
  ADMIN_AREA_ACCESS: "admin-area:access",

  PARTICIPANTS_VIEW: "participants:view",
  PARTICIPANTS_CREATE: "participants:create",
  PARTICIPANTS_EDIT: "participants:edit",
  PARTICIPANTS_DEACTIVATE: "participants:deactivate",

  HEALTH_DATA_VIEW: "health-data:view",

  RESEARCH_VIEW: "research:view",
  RESEARCH_MANAGE_STUDIES: "research:manage-studies",
  RESEARCH_EXPORT: "research:export",

  EDUCATION_MANAGE: "education:manage",
  EXERCISE_CONTENT_MANAGE: "exercise-content:manage",
  NOTIFICATIONS_MANAGE: "notifications:manage",
  REPORTS_VIEW: "reports:view",

  AUDIT_VIEW: "audit:view",
  AUDIT_EXPORT: "audit:export",

  ADMINS_MANAGE: "admins:manage",
  SETTINGS_MANAGE: "settings:manage",
  THRESHOLDS_MANAGE: "thresholds:manage",
  STORAGE_UPLOAD: "storage:upload",

  /// Two of the registered flags gate clinical dose calculators, so this
  /// gets the same SUPER_ADMIN-only posture as SETTINGS_MANAGE rather than
  /// riding along with EDUCATION_MANAGE.
  FEATURE_FLAGS_MANAGE: "feature-flags:manage",
} as const;

export type CapabilityValue = (typeof Capability)[keyof typeof Capability];

/**
 * Role → capability matrix.
 *
 * This deployment serves one study with one operating team, not the
 * platform's original multi-role newsroom — so there are only two roles:
 *
 *  PATIENT  owns their own records and holds no administrative capability
 *           at all; their access is handled by ownership checks, not by
 *           this table.
 *  ADMIN    the single staff role, holding every staff capability —
 *           participants, content, messaging, settings, audit, staff
 *           accounts. The platform's former SUPER_ADMIN/RESEARCHER/
 *           CLINICAL_REVIEWER split existed for a multi-team deployment
 *           this one isn't; ADMIN is simply the union of what all three
 *           used to hold.
 */
const MATRIX: Record<UserRole, readonly CapabilityValue[]> = {
  PATIENT: [],

  ADMIN: [
    Capability.ADMIN_AREA_ACCESS,
    Capability.PARTICIPANTS_VIEW,
    Capability.PARTICIPANTS_CREATE,
    Capability.PARTICIPANTS_EDIT,
    Capability.PARTICIPANTS_DEACTIVATE,
    Capability.HEALTH_DATA_VIEW,
    Capability.RESEARCH_VIEW,
    Capability.RESEARCH_MANAGE_STUDIES,
    Capability.RESEARCH_EXPORT,
    Capability.EDUCATION_MANAGE,
    Capability.EXERCISE_CONTENT_MANAGE,
    Capability.NOTIFICATIONS_MANAGE,
    Capability.REPORTS_VIEW,
    Capability.AUDIT_VIEW,
    Capability.AUDIT_EXPORT,
    Capability.ADMINS_MANAGE,
    Capability.SETTINGS_MANAGE,
    Capability.THRESHOLDS_MANAGE,
    Capability.STORAGE_UPLOAD,
    Capability.FEATURE_FLAGS_MANAGE,
  ],
};

const CAPABILITY_SETS: Record<UserRole, ReadonlySet<CapabilityValue>> = {
  PATIENT: new Set(MATRIX.PATIENT),
  ADMIN: new Set(MATRIX.ADMIN),
};

/** Does this role hold the capability, ignoring any per-resource narrowing? */
export function roleHas(role: UserRole, capability: CapabilityValue): boolean {
  return CAPABILITY_SETS[role]?.has(capability) ?? false;
}

export function capabilitiesFor(role: UserRole): CapabilityValue[] {
  return [...(MATRIX[role] ?? [])];
}

export const STAFF_ROLES: readonly UserRole[] = ["ADMIN"];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  PATIENT: "Participant",
  ADMIN: "Administrator",
};
