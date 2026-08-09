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
} as const;

export type CapabilityValue = (typeof Capability)[keyof typeof Capability];

/**
 * Role → capability matrix.
 *
 *  PATIENT            owns their own records and holds no administrative
 *                     capability at all; their access is handled by ownership
 *                     checks, not by this table.
 *  RESEARCHER         sees participants and health data only for studies they
 *                     have been granted access to (narrowed in `policies.ts`),
 *                     and may export only where `StudyAccess.canExport` is set.
 *  CLINICAL_REVIEWER  read-only clinical oversight, plus ownership of the
 *                     configurable clinical thresholds.
 *  ADMIN              day-to-day operations: participants, content, messaging.
 *  SUPER_ADMIN        everything, including staff accounts and settings.
 */
const MATRIX: Record<UserRole, readonly CapabilityValue[]> = {
  PATIENT: [],

  RESEARCHER: [
    Capability.ADMIN_AREA_ACCESS,
    Capability.PARTICIPANTS_VIEW,
    Capability.HEALTH_DATA_VIEW,
    Capability.RESEARCH_VIEW,
    Capability.RESEARCH_EXPORT,
    Capability.REPORTS_VIEW,
  ],

  CLINICAL_REVIEWER: [
    Capability.ADMIN_AREA_ACCESS,
    Capability.PARTICIPANTS_VIEW,
    Capability.HEALTH_DATA_VIEW,
    Capability.REPORTS_VIEW,
    Capability.THRESHOLDS_MANAGE,
  ],

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
    Capability.STORAGE_UPLOAD,
  ],

  SUPER_ADMIN: [
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
  ],
};

const CAPABILITY_SETS: Record<UserRole, ReadonlySet<CapabilityValue>> = {
  PATIENT: new Set(MATRIX.PATIENT),
  RESEARCHER: new Set(MATRIX.RESEARCHER),
  CLINICAL_REVIEWER: new Set(MATRIX.CLINICAL_REVIEWER),
  ADMIN: new Set(MATRIX.ADMIN),
  SUPER_ADMIN: new Set(MATRIX.SUPER_ADMIN),
};

/** Does this role hold the capability, ignoring any per-resource narrowing? */
export function roleHas(role: UserRole, capability: CapabilityValue): boolean {
  return CAPABILITY_SETS[role]?.has(capability) ?? false;
}

export function capabilitiesFor(role: UserRole): CapabilityValue[] {
  return [...(MATRIX[role] ?? [])];
}

export const STAFF_ROLES: readonly UserRole[] = [
  "ADMIN",
  "SUPER_ADMIN",
  "RESEARCHER",
  "CLINICAL_REVIEWER",
];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  PATIENT: "Participant",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
  RESEARCHER: "Researcher",
  CLINICAL_REVIEWER: "Clinical reviewer",
};
