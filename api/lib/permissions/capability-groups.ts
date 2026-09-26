import { Capability, type CapabilityValue } from "@/lib/permissions/roles";

/**
 * Capabilities grouped the way a coordinator sees the sidebar (see
 * lib/navigation.ts), for the "limit this account to..." picker on a staff
 * account. Picking a group grants every capability in it; nothing here is
 * exposed one capability at a time; there's no page a coordinator would
 * recognise "participants:deactivate" as belonging to.
 *
 * `ADMIN_AREA_ACCESS` is granted to every staff account automatically and
 * never appears here — it only means "may open the dashboard at all", not
 * access to any specific section.
 *
 * A few capabilities are deliberately left out of every group below —
 * SETTINGS_MANAGE, FEATURE_FLAGS_MANAGE, STORAGE_UPLOAD, HEALTH_DATA_VIEW,
 * NOTIFICATIONS_MANAGE, and the RESEARCH_* set — because they either affect
 * the whole deployment (flags, settings) or have no page of their own in
 * this nav. A limited account never receives these; only a full-access
 * account does.
 */
export interface CapabilityGroup {
  key: string;
  label: string;
  capabilities: CapabilityValue[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    key: "families",
    label: "Families",
    capabilities: [
      Capability.PARTICIPANTS_VIEW,
      Capability.PARTICIPANTS_CREATE,
      Capability.PARTICIPANTS_EDIT,
      Capability.PARTICIPANTS_DEACTIVATE,
      Capability.PARTICIPANTS_DELETE,
    ],
  },
  {
    key: "content",
    label: "Help Book & Quizzes",
    capabilities: [Capability.EDUCATION_MANAGE],
  },
  {
    key: "calculators",
    label: "Calculators",
    capabilities: [Capability.CALCULATORS_MANAGE],
  },
  {
    key: "support",
    label: "Help requests",
    capabilities: [Capability.SUPPORT_RESPOND],
  },
  {
    key: "reports",
    label: "Reports",
    capabilities: [Capability.REPORTS_VIEW],
  },
  {
    key: "audit",
    label: "Activity history",
    capabilities: [Capability.AUDIT_VIEW, Capability.AUDIT_EXPORT],
  },
  {
    key: "admins",
    label: "Who can sign in",
    capabilities: [Capability.ADMINS_MANAGE],
  },
  {
    key: "thresholds",
    label: "Safe glucose ranges",
    capabilities: [Capability.THRESHOLDS_MANAGE],
  },
];
