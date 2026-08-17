import { Capability, type CapabilityValue } from "@/lib/permissions/roles";

/**
 * Icon *names*, not component references. `NAVIGATION` is built in a Server
 * Component (app/admin/(dashboard)/layout.tsx) and passed as a prop into
 * `AdminShell`, a Client Component — and a Lucide icon is a forwardRef
 * component (a function under the hood), which cannot cross that boundary.
 * `sidebar-nav.tsx` (itself a Client Component) resolves these names back to
 * the actual components via `ICON_MAP`.
 */
export type IconName =
  | "Activity"
  | "BookOpen"
  | "ClipboardList"
  | "Cog"
  | "Dumbbell"
  | "FileBarChart"
  | "FlaskConical"
  | "LayoutDashboard"
  | "ScrollText"
  | "ShieldCheck"
  | "Users";

/**
 * The admin sidebar.
 *
 * Each entry declares the capability required to see it, so the navigation is
 * derived from the same permission matrix the API enforces — a role can never
 * be shown a section whose endpoints would reject it.
 *
 * Hiding an item is a usability measure, not a security one: the pages and
 * routes behind them check authorisation independently.
 */

export interface NavItem {
  label: string;
  href: string;
  capability: CapabilityValue;
  /** Marks the entry active for nested routes too. */
  matchPrefix?: boolean;
}

export interface NavSection {
  label?: string;
  icon: IconName;
  /** A section either links directly or expands into children, never both. */
  href?: string;
  capability: CapabilityValue;
  items?: NavItem[];
  matchPrefix?: boolean;
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/admin/dashboard",
    capability: Capability.ADMIN_AREA_ACCESS,
  },
  {
    label: "Participants",
    icon: "Users",
    href: "/admin/participants",
    capability: Capability.PARTICIPANTS_VIEW,
    matchPrefix: true,
  },
  {
    label: "Health data",
    icon: "Activity",
    capability: Capability.HEALTH_DATA_VIEW,
    items: [
      { label: "Glucose", href: "/admin/health/glucose", capability: Capability.HEALTH_DATA_VIEW },
      {
        label: "Medications",
        href: "/admin/health/medications",
        capability: Capability.HEALTH_DATA_VIEW,
      },
      { label: "Insulin", href: "/admin/health/insulin", capability: Capability.HEALTH_DATA_VIEW },
      { label: "Meals", href: "/admin/health/meals", capability: Capability.HEALTH_DATA_VIEW },
      { label: "Exercise", href: "/admin/health/exercise", capability: Capability.HEALTH_DATA_VIEW },
      { label: "HbA1c", href: "/admin/health/hba1c", capability: Capability.HEALTH_DATA_VIEW },
      {
        label: "Health metrics",
        href: "/admin/health/metrics",
        capability: Capability.HEALTH_DATA_VIEW,
      },
    ],
  },
  {
    label: "Research",
    icon: "FlaskConical",
    capability: Capability.RESEARCH_VIEW,
    items: [
      { label: "Studies", href: "/admin/research/studies", capability: Capability.RESEARCH_VIEW, matchPrefix: true },
      {
        label: "Data export",
        href: "/admin/research/export",
        capability: Capability.RESEARCH_EXPORT,
      },
    ],
  },
  {
    label: "Content",
    icon: "BookOpen",
    capability: Capability.EDUCATION_MANAGE,
    items: [
      {
        label: "Education",
        href: "/admin/content/education",
        capability: Capability.EDUCATION_MANAGE,
        matchPrefix: true,
      },
      {
        label: "Exercise programmes",
        href: "/admin/content/exercises",
        capability: Capability.EXERCISE_CONTENT_MANAGE,
        matchPrefix: true,
      },
      {
        label: "Quizzes",
        href: "/admin/content/quizzes",
        capability: Capability.EDUCATION_MANAGE,
        matchPrefix: true,
      },
    ],
  },
  {
    label: "Notifications",
    icon: "ClipboardList",
    href: "/admin/notifications",
    capability: Capability.NOTIFICATIONS_MANAGE,
    matchPrefix: true,
  },
  {
    label: "Reports",
    icon: "FileBarChart",
    href: "/admin/reports",
    capability: Capability.REPORTS_VIEW,
  },
  {
    label: "Audit logs",
    icon: "ScrollText",
    href: "/admin/audit-logs",
    capability: Capability.AUDIT_VIEW,
  },
  {
    label: "Administrators",
    icon: "ShieldCheck",
    href: "/admin/administrators",
    capability: Capability.ADMINS_MANAGE,
    matchPrefix: true,
  },
  {
    label: "Settings",
    icon: "Cog",
    capability: Capability.SETTINGS_MANAGE,
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        capability: Capability.SETTINGS_MANAGE,
      },
      {
        label: "Feature flags",
        href: "/admin/settings/feature-flags",
        capability: Capability.FEATURE_FLAGS_MANAGE,
      },
    ],
  },
];

/** Secondary entry used by clinical reviewers who manage thresholds. */
export const THRESHOLDS_NAV: NavSection = {
  label: "Clinical thresholds",
  icon: "Dumbbell",
  href: "/admin/thresholds",
  capability: Capability.THRESHOLDS_MANAGE,
};

/** Filters the tree down to what the given capabilities allow. */
export function visibleNavigation(held: ReadonlySet<CapabilityValue>): NavSection[] {
  const sections = [...NAVIGATION];

  // Thresholds sit under Settings for super admins, but clinical reviewers
  // have no Settings entry — surface it directly for them.
  if (held.has(Capability.THRESHOLDS_MANAGE) && !held.has(Capability.SETTINGS_MANAGE)) {
    sections.push(THRESHOLDS_NAV);
  }

  return sections
    .filter((section) => held.has(section.capability))
    .map((section) => ({
      ...section,
      items: section.items?.filter((item) => held.has(item.capability)),
    }))
    .filter((section) => section.href || (section.items && section.items.length > 0));
}

export function isActivePath(
  pathname: string,
  href: string,
  matchPrefix?: boolean,
): boolean {
  if (matchPrefix) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}
