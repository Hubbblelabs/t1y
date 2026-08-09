import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardContent } from "@/components/admin/dashboard/dashboard-content";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { StatSkeleton, ChartSkeleton } from "@/components/ui/states";
import { Card } from "@/components/ui/card";
import { dateRangeSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Executive overview.
 *
 * The shell renders immediately and the data streams in through Suspense, so
 * the page never shows a blank screen while the aggregate queries run.
 */
export default async function DashboardPage(props: PageProps<"/admin/dashboard">) {
  const searchParams = await props.searchParams;

  // Fall back to the default range rather than erroring on a hand-edited URL.
  const parsed = dateRangeSchema.safeParse(searchParams);
  const range = parsed.success ? parsed.data : { range: "30d" as const };

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Overview of the diabetes management platform"
        actions={<DateRangePicker />}
      />

      <Suspense key={JSON.stringify(range)} fallback={<DashboardFallback />}>
        <DashboardContent range={range} />
      </Suspense>
    </PageContainer>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <ChartSkeleton />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <ChartSkeleton height={220} />
        </Card>
        <Card className="p-5">
          <ChartSkeleton height={220} />
        </Card>
      </div>
    </div>
  );
}
