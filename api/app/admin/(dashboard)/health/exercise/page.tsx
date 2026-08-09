import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { requirePrincipal } from "@/lib/auth/session";
import { browseExercise } from "@/lib/services/health-browser";
import { formatDuration, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Exercise" };

export default async function ExercisePage(props: PageProps<"/admin/health/exercise">) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseExercise(principal, params);

  return (
    <HealthPage
      title="Exercise"
      description="Logged exercise sessions across participants"
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[
          { label: "Activity" },
          { label: "Category" },
          { label: "Duration", align: "right" },
          { label: "Intensity" },
          { label: "Distance", align: "right" },
        ]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.performedAt,
          cells: [
            { label: "Activity", value: item.activityName },
            { label: "Category", value: humaniseEnum(item.category) },
            {
              label: "Duration",
              align: "right",
              value: formatDuration(item.durationMinutes),
            },
            { label: "Intensity", value: humaniseEnum(item.intensity) },
            {
              label: "Distance",
              align: "right",
              value: formatNumber(item.distanceKm, { decimals: 2, unit: "km" }),
            },
          ],
        }))}
        emptyTitle="No exercise sessions"
        emptyDescription="No sessions were logged in the selected period."
      />
    </HealthPage>
  );
}
