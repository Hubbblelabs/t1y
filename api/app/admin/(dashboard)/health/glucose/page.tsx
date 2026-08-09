import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseGlucose } from "@/lib/services/health-browser";
import { formatGlucoseUnit, humaniseEnum } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Glucose" };

export default async function GlucosePage(
  props: PageProps<"/admin/health/glucose">,
) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  return (
    <HealthPage
      title="Glucose"
      description="Recorded glucose readings across participants"
      searchKey={JSON.stringify(searchParams)}
    >
      <GlucoseTable principal={principal} params={params} />
    </HealthPage>
  );
}

async function GlucoseTable({
  principal,
  params,
}: {
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  params: ReturnType<typeof parseBrowseParams>;
}) {
  const { items, total } = await browseGlucose(principal, params);

  return (
    <HealthBrowserTable
      page={params.page}
      pageSize={params.take}
      total={total}
      columns={[
        { label: "Value", align: "right" },
        { label: "Context" },
        { label: "Source" },
      ]}
      rows={items.map((item) => ({
        id: item.id,
        user: item.user,
        occurredAt: item.measuredAt,
        cells: [
          {
            label: "Value",
            align: "right",
            value: `${item.value} ${formatGlucoseUnit(item.unit)}`,
          },
          { label: "Context", value: humaniseEnum(item.context) },
          { label: "Source", value: humaniseEnum(item.source) },
        ],
      }))}
      emptyTitle="No glucose readings"
      emptyDescription="No readings were recorded in the selected period. Try widening the date range."
    />
  );
}
