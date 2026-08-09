import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseInsulin } from "@/lib/services/health-browser";
import { humaniseEnum } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Insulin" };

/**
 * Recorded insulin administrations.
 *
 * A read-only register of what participants reported administering. The
 * platform performs no dose calculation and offers no dosing guidance.
 */
export default async function InsulinPage(props: PageProps<"/admin/health/insulin">) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseInsulin(principal, params);

  return (
    <HealthPage
      title="Insulin"
      description="Recorded administrations. Doses are entered by participants; the platform does not calculate or recommend them."
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[
          { label: "Insulin" },
          { label: "Type" },
          { label: "Dose", align: "right" },
          { label: "Site" },
          { label: "Meal" },
        ]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.administeredAt,
          cells: [
            { label: "Insulin", value: item.insulinName },
            { label: "Type", value: humaniseEnum(item.insulinType) },
            {
              label: "Dose",
              align: "right",
              value: `${item.doseUnits} ${item.unit}`,
            },
            { label: "Site", value: humaniseEnum(item.injectionSite) },
            { label: "Meal", value: humaniseEnum(item.mealAssociation) },
          ],
        }))}
        emptyTitle="No insulin records"
        emptyDescription="No administrations were recorded in the selected period."
      />
    </HealthPage>
  );
}
