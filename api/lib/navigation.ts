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

/**
 * Removed from this navigation, deliberately:
 *
 * - **Announcements** (push campaigns). Nothing in this study sends them,
 *   and a section whose only function was to schedule messages nobody was
 *   writing is just a place to get lost. The routes and tables still exist.
 * - **Settings**. "General settings" and the global feature-flag switches are
 *   both being replaced by per-account permissions, which is where deciding
 *   what a member of staff can do belongs. Until that lands there is nothing
 *   here a coordinator needs, so it is not shown.
 *
 * Neither was deleted — no data is lost and either can come back by
 * restoring its entry. "Questions we ask them" keeps its own route under
 * /admin/settings/profile-fields and is reached from the Families section.
 *
 * Wording rule for everything in this file, and for the pages it points at:
 * the people running this dashboard are study coordinators and nurses, not
 * developers. Labels name the thing in the language they already use —
 * "Help Book", "Questions we ask families", "Who can sign in" — never the
 * language the database uses. Internal vocabulary (slug, locale, flag,
 * definition) stays in the code and out of the interface.
 */
export const NAVIGATION: NavSection[] = [
  {
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/admin/dashboard",
    capability: Capability.ADMIN_AREA_ACCESS,
  },
  {
    label: "Families",
    icon: "Users",
    capability: Capability.PARTICIPANTS_VIEW,
    items: [
      {
        label: "Children and parents",
        href: "/admin/participants",
        capability: Capability.PARTICIPANTS_VIEW,
        matchPrefix: true,
      },
      {
        label: "Questions we ask them",
        href: "/admin/settings/profile-fields",
        capability: Capability.SETTINGS_MANAGE,
      },
    ],
  },
  // "Health data" (Glucose/Medications/Insulin/Meals/Exercise/HbA1c/Health
  // metrics) and "Research" (Studies/Data export) are deliberately not
  // listed here. Both are pre-existing platform surface from the original
  // generic multi-condition, multi-study "Digital Diabetes Management
  // Platform" this deployment was built from — see
  // docs/UNUSED-BACKEND.md. This study's Flutter app has no logging screens
  // at all (v1 is curriculum + calculators + quizzes only) and is one
  // single Coimbatore cohort, not a multi-study research programme, so
  // every one of those pages would only ever show empty tables to a
  // coordinator wondering why. The routes and admin pages still exist
  // (nothing was deleted) — they're just not surfaced in this nav.
  {
    label: "What families see",
    icon: "BookOpen",
    capability: Capability.EDUCATION_MANAGE,
    items: [
      {
        label: "Help Book",
        href: "/admin/content/education",
        capability: Capability.EDUCATION_MANAGE,
        matchPrefix: true,
      },
      {
        label: "Quizzes",
        href: "/admin/content/quizzes",
        capability: Capability.EDUCATION_MANAGE,
        matchPrefix: true,
      },
      {
        label: "Calculators",
        href: "/admin/content/calculators",
        capability: Capability.CALCULATORS_MANAGE,
        matchPrefix: true,
      },
    ],
  },
  {
    label: "Help requests",
    icon: "ClipboardList",
    href: "/admin/support",
    capability: Capability.SUPPORT_RESPOND,
    matchPrefix: true,
  },
  {
    label: "Reports",
    icon: "FileBarChart",
    href: "/admin/reports",
    capability: Capability.REPORTS_VIEW,
  },
  {
    label: "Activity history",
    icon: "ScrollText",
    href: "/admin/audit-logs",
    capability: Capability.AUDIT_VIEW,
  },
  {
    label: "Who can sign in",
    icon: "ShieldCheck",
    href: "/admin/administrators",
    capability: Capability.ADMINS_MANAGE,
    matchPrefix: true,
  },
];

/** Secondary entry used by clinical reviewers who manage thresholds. */
export const THRESHOLDS_NAV: NavSection = {
  label: "Safe glucose ranges",
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
