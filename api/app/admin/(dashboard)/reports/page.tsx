import type { Metadata } from "next";
import { Suspense } from "react";

import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageContainer, PageHeader, Section } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  CategoryBars,
  TrendBarChart,
  TrendLineChart,
} from "@/components/charts/trend-charts";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, StatSkeleton } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { getCohortBreakdown, getDashboardOverview } from "@/lib/services/analytics";
import { getAggregateGlucoseTrend } from "@/lib/services/glucose";
import { getAdherenceTrend } from "@/lib/services/medications";
import { getExerciseTrend } from "@/lib/services/exercise";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { prisma } from "@/lib/db/prisma";
import {
  DATE_RANGE_LABELS,
  dateRangeSchema,
  resolveDateRange,
  type DateRangeInput,
} from "@/lib/validation/common";
import { formatDuration, formatNumber, formatPercent, humaniseEnum } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Reports" };

/**
 * Operational reporting.
 *
 * Descriptive throughout: cohort composition, engagement and adherence over
 * the selected period. It reports what was recorded and draws no conclusions
 * from it.
 */
export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  const searchParams = await props.searchParams;
  const parsed = dateRangeSchema.safeParse(searchParams);
  const range = parsed.success ? parsed.data : { range: "30d" as const };

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Platform activity and cohort composition for the selected period"
        actions={<DateRangePicker />}
      />

      <Suspense key={JSON.stringify(range)} fallback={<ReportsFallback />}>
        <ReportsContent range={range} />
      </Suspense>
    </PageContainer>
  );
}

async function ReportsContent({ range }: { range: DateRangeInput }) {
  const principal = await requirePrincipal();
  const resolved = resolveDateRange(range);
  const rangeLabel = DATE_RANGE_LABELS[range.range];
  const interval = range.range === "7d" || range.range === "30d" ? "day" : "week";

  const scope = await participantScopeFilter(principal);
  const visible = await prisma.user.findMany({
    where: { ...scope, role: "PATIENT", deletedAt: null },
    select: { id: true },
  });
  const userIds = visible.map((user) => user.id);
  const unrestricted = Object.keys(scope).length === 0;
  const cohortScope = unrestricted ? {} : { userIds };

  const [overview, breakdown, glucoseSeries, adherenceSeries, exerciseSeries] =
    await Promise.all([
      getDashboardOverview(principal, resolved),
      getCohortBreakdown(principal),
      getAggregateGlucoseTrend({
        ...cohortScope,
        from: resolved.from,
        to: resolved.to,
        interval,
        unit: "MG_DL",
      }),
      getAdherenceTrend({
        ...cohortScope,
        from: resolved.from,
        to: resolved.to,
        interval,
      }),
      getExerciseTrend({
        ...cohortScope,
        from: resolved.from,
        to: resolved.to,
        interval,
      }),
    ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cohort size" value={formatNumber(userIds.length)} />
        <StatCard
          label="Records logged"
          value={formatNumber(overview.activity.recordsLoggedInPeriod)}
          hint={rangeLabel}
        />
        <StatCard
          label="Medication adherence"
          value={formatPercent(overview.adherence.percent, 1)}
          hint={`${formatNumber(overview.adherence.taken)} of ${formatNumber(overview.adherence.taken + overview.adherence.missed + overview.adherence.skipped)} doses`}
        />
        <StatCard
          label="Exercise recorded"
          value={formatDuration(overview.exercise.totalMinutes)}
          hint={`${formatNumber(overview.exercise.sessionCount)} sessions`}
        />
      </div>

      <Section title="Engagement over time" description={rangeLabel}>
        <div className="grid gap-4">
          <TrendLineChart
            title="Glucose readings"
            unit="mg/dL"
            rangeLabel={rangeLabel}
            data={glucoseSeries}
            series={[{ key: "average", name: "Cohort average", colour: "var(--color-chart-1)" }]}
            emptyTitle="No glucose readings"
            emptyDescription="No readings were recorded across the cohort during this period."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <TrendLineChart
              title="Medication adherence"
              unit="%"
              rangeLabel={rangeLabel}
              height={220}
              data={adherenceSeries}
              series={[
                { key: "adherencePercent", name: "Adherence", colour: "var(--color-chart-3)" },
              ]}
              emptyTitle="No doses came due"
              emptyDescription="No scheduled doses fell within this period."
            />

            <TrendBarChart
              title="Exercise minutes"
              unit="minutes"
              rangeLabel={rangeLabel}
              height={220}
              data={exerciseSeries}
              series={[{ key: "minutes", name: "Minutes", colour: "var(--color-chart-2)" }]}
              emptyTitle="No exercise recorded"
              emptyDescription="No sessions were logged during this period."
            />
          </div>
        </div>
      </Section>

      <Section title="Cohort composition" description="Current registered participants">
        <div className="grid gap-4 lg:grid-cols-3">
          <CategoryBars
            title="By diabetes type"
            valueLabel="Participants"
            data={breakdown.byDiabetesType.map((entry) => ({
              label: humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
          <CategoryBars
            title="By treatment"
            valueLabel="Participants"
            data={breakdown.byTreatmentModality.map((entry) => ({
              label: humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
          <CategoryBars
            title="By account status"
            valueLabel="Participants"
            data={breakdown.byStatus.map((entry) => ({
              label: humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
        </div>
      </Section>
    </div>
  );
}

function ReportsFallback() {
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
    </div>
  );
}
