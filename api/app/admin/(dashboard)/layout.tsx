import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getPrincipal } from "@/lib/auth/session";
import { visibleNavigation } from "@/lib/navigation";
import { canAccessAdminArea } from "@/lib/permissions/policies";
import { capabilitiesFor, ROLE_LABELS } from "@/lib/permissions/roles";

/**
 * Authorisation boundary for the authenticated admin area.
 *
 * `proxy.ts` performs an optimistic cookie check so signed-out visitors are
 * redirected without a database round trip, but this layout is the real gate:
 * it resolves the session against the database on every request and rejects
 * any principal without `ADMIN_AREA_ACCESS` — including a participant holding
 * a perfectly valid session.
 *
 * Individual pages and API routes check their own capabilities as well. This
 * is the outer boundary, not the only one.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const principal = await getPrincipal();

  if (!principal) {
    redirect("/admin/login");
  }

  if (!canAccessAdminArea(principal)) {
    redirect("/admin/no-access");
  }

  const sections = visibleNavigation(new Set(capabilitiesFor(principal.role)));

  return (
    <AdminShell
      sections={sections}
      user={{
        name: principal.name,
        email: principal.email,
        roleLabel: ROLE_LABELS[principal.role],
      }}
    >
      {children}
    </AdminShell>
  );
}
