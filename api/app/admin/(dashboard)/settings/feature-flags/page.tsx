import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { FeatureFlagsPanel, type FlagRow } from "@/components/admin/settings/feature-flags-panel";
import { getFeatureFlags } from "@/lib/services/feature-flags";

export const metadata: Metadata = { title: "Feature flags" };

export default async function FeatureFlagsPage() {
  const flags = await getFeatureFlags();

  const rows: FlagRow[] = Object.entries(flags).map(([key, value]) => ({
    key,
    enabled: value.enabled,
    description: value.description,
    clinicalSafety: value.clinicalSafety,
    safetyNotice: value.safetyNotice,
    updatedAt: value.updatedAt ? value.updatedAt.toISOString() : null,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Feature flags"
        description="Controls what the mobile app shows. Two of these gate clinical dose calculators."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Feature flags" }]}
      />
      <FeatureFlagsPanel initial={rows} />
    </PageContainer>
  );
}
