import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseHbA1c } from "@/lib/services/health-browser";
import { formatNumber, humaniseEnum } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "HbA1c" };

/**
 * HbA1c results across participants.
 *
 * Values are listed without classification. Whether a result is acceptable
 * depends on the individual's care plan and on a configured clinical
 * threshold, so the table reports the number and its provenance only.
 */
export default async function HbA1cPage(props: PageProps<"/admin/health/hba1c">) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseHbA1c(principal, params);

  return (
    <HealthPage
      title="HbA1c"
      description="Recorded HbA1c results and their source"
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[
          { label: "HbA1c", align: "right" },
          { label: "IFCC", align: "right" },
          { label: "Source" },
          { label: "Laboratory" },
        ]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.measuredAt,
          cells: [
            { label: "HbA1c", align: "right", value: `${item.valuePercent}%` },
            {
              label: "IFCC",
              align: "right",
              value: formatNumber(item.valueMmolMol, { decimals: 1, unit: "mmol/mol" }),
            },
            { label: "Source", value: humaniseEnum(item.source) },
            { label: "Laboratory", value: item.laboratoryName ?? "—" },
          ],
        }))}
        emptyTitle="No HbA1c results"
        emptyDescription="No results were recorded in the selected period."
      />
    </HealthPage>
  );
}
