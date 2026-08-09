import type { Metadata } from "next";

import {
  DoseStatusBadge,
  HealthBrowserTable,
} from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseMedicationLogs } from "@/lib/services/health-browser";
import { formatDateTime } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Medications" };

export default async function MedicationsPage(
  props: PageProps<"/admin/health/medications">,
) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseMedicationLogs(principal, params);

  return (
    <HealthPage
      title="Medications"
      description="Scheduled doses and the outcome recorded for each"
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[{ label: "Medication" }, { label: "Outcome" }, { label: "Taken at" }]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.scheduledFor ?? item.createdAt,
          cells: [
            {
              label: "Medication",
              value: (
                <>
                  <span className="font-medium">{item.medication.name}</span>
                  <span className="text-ink-subtle ml-1.5 text-xs">
                    {item.medication.dosageText}
                  </span>
                </>
              ),
            },
            { label: "Outcome", value: <DoseStatusBadge status={item.status} /> },
            {
              label: "Taken at",
              value: item.takenAt ? formatDateTime(item.takenAt) : "—",
            },
          ],
        }))}
        emptyTitle="No medication records"
        emptyDescription="No doses were scheduled or logged in the selected period."
      />
    </HealthPage>
  );
}
