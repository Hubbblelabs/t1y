import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import {
  ProfileFieldsPanel,
  type ProfileFieldRow,
} from "@/components/admin/settings/profile-fields-panel";
import type { ProfileFieldRules } from "@/lib/services/profile-field-rules";
import { listAllProfileFieldDefinitions } from "@/lib/services/profile-fields";

export const metadata: Metadata = { title: "Questions we ask families" };

/**
 * Every question a parent is asked about their child: the ones built into
 * the app, and any added here. See lib/services/profile-fields.ts — there is
 * no delete, only being asked or not, so retiring a question never loses
 * what a family already answered.
 */
export default async function ProfileFieldsPage() {
  const fields = await listAllProfileFieldDefinitions();

  const rows: ProfileFieldRow[] = fields.map((field) => ({
    ...field,
    options: (field.options as ProfileFieldRow["options"]) ?? null,
    rules: (field.rules as ProfileFieldRules | null) ?? null,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Questions we ask families"
        description="What each question is, what kind of answer it takes, what counts as a good answer, and whether it is asked at sign-up or on the profile. Making a question required only applies going forward — it is never held against a profile that is already saved."
        breadcrumbs={[{ label: "Families" }, { label: "Questions we ask them" }]}
      />
      <ProfileFieldsPanel initial={rows} />
    </PageContainer>
  );
}
