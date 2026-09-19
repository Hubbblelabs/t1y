import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ProfileFieldsPanel } from "@/components/admin/settings/profile-fields-panel";
import { listAllProfileFieldDefinitions } from "@/lib/services/profile-fields";

export const metadata: Metadata = { title: "Profile fields" };

/**
 * Admin-defined fields on the parent-facing profile form, on top of the
 * fixed set the app has always had. See lib/services/profile-fields.ts —
 * there is no delete, only active/inactive, so retiring a field never loses
 * what a family already answered under it.
 */
export default async function ProfileFieldsPage() {
  const fields = await listAllProfileFieldDefinitions();

  return (
    <PageContainer>
      <PageHeader
        title="Profile fields"
        description="Extra fields shown on the parent's profile form, beyond the built-in ones. Requiring a field only applies to the form going forward — it is never enforced against profiles already saved."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Profile fields" }]}
      />
      <ProfileFieldsPanel
        initial={fields.map((f) => ({
          ...f,
          options: (f.options as { value: string; labelEn: string; labelTa?: string }[] | null) ?? null,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
