import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseHealthMetrics } from "@/lib/services/health-browser";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Health metrics" };

/**
 * Configurable health metrics — weight, blood pressure, heart rate, BMI and
 * anything added since. The metric list comes from the database, so a new
 * definition appears here without a code change.
 */
export default async function HealthMetricsPage(
  props: PageProps<"/admin/health/metrics">,
) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseHealthMetrics(principal, params);

  return (
    <HealthPage
      title="Health metrics"
      description="Weight, blood pressure and other tracked measurements"
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[{ label: "Metric" }, { label: "Value", align: "right" }]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.measuredAt,
          cells: [
            { label: "Metric", value: item.definition.label },
            {
              label: "Value",
              align: "right",
              value:
                // Composite metrics such as blood pressure read "120/80 mmHg".
                item.definition.valueType === "COMPOSITE" && item.secondaryValue !== null
                  ? `${item.value ?? "—"}/${item.secondaryValue} ${item.unit}`
                  : `${item.value ?? "—"} ${item.unit}`,
            },
          ],
        }))}
        emptyTitle="No measurements recorded"
        emptyDescription="No health metrics were recorded in the selected period."
      />
    </HealthPage>
  );
}
