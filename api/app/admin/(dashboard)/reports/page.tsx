import type { Metadata } from "next";
import { Suspense } from "react";

import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageContainer, PageHeader, Section } from "@/components/admin/page-header";
import { ReportParticipantPicker } from "@/components/admin/reports/participant-picker";
import { StatCard } from "@/components/admin/stat-card";
import { CategoryBars, TrendLineChart } from "@/components/charts/trend-charts";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, StatSkeleton } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { getCohortBreakdown, getDashboardOverview } from "@/lib/services/analytics";
import { getAggregateGlucoseTrend } from "@/lib/services/glucose";
import { getResearchStats } from "@/lib/services/research-stats";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { prisma } from "@/lib/db/prisma";
import {
  DATE_RANGE_LABELS,
  dateRangeSchema,
  resolveDateRange,
  type DateRangeInput,
} from "@/lib/validation/common";
import { formatNumber, humaniseEnum } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Reports" };

/**
 * How the study is going, in plain terms.
 *
 * Descriptive throughout: who has signed up and what they have recorded over
 * the chosen period. It reports what happened and draws no conclusions.
 *
 * Medication adherence and exercise minutes used to be reported here. Neither
 * is something this study's app records, so both only ever showed empty
 * charts; they were removed rather than left to look like missing data.
 */
export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  const searchParams = await props.searchParams;
  const parsed = dateRangeSchema.safeParse(searchParams);
  const range = parsed.success ? parsed.data : { range: "30d" as const };
  const userId = typeof searchParams.userId === "string" ? searchParams.userId : undefined;

  const principal = await requirePrincipal();
  const selected = userId
    ? await prisma.user.findFirst({
        where: { id: userId, ...(await participantScopeFilter(principal)), role: "PATIENT", deletedAt: null },
        select: { id: true, name: true, profile: { select: { participantCode: true } } },
      })
    : null;

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description={
          selected
            ? `${selected.name}'s own numbers, for the time you choose`
            : "Who has signed up and what they have recorded, for the time you choose"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportParticipantPicker selectedName={selected?.name} />
            <DateRangePicker />
          </div>
        }
      />

      <Suspense key={JSON.stringify({ range, userId: selected?.id })} fallback={<ReportsFallback />}>
        {selected ? (
          <ParticipantReportContent userId={selected.id} range={range} />
        ) : (
          <ReportsContent range={range} />
        )}
      </Suspense>
    </PageContainer>
  );
}

/** One child's own numbers — everyone-wide breakdowns (who signed up, cohort totals) don't apply here. */
async function ParticipantReportContent({
  userId,
  range,
}: {
  userId: string;
  range: DateRangeInput;
}) {
  const resolved = resolveDateRange(range);
  const rangeLabel = DATE_RANGE_LABELS[range.range];
  const interval = range.range === "7d" || range.range === "30d" ? "day" : "week";

  const [glucoseSeries, research] = await Promise.all([
    getAggregateGlucoseTrend({
      userIds: [userId],
      from: resolved.from,
      to: resolved.to,
      interval,
      unit: "MG_DL",
    }),
    getResearchStats({ userIds: [userId], from: resolved.from, to: resolved.to }),
  ]);
  const g = research.glucose;
  const insulin = research.insulin;
  const one = (value: number | null, unit?: string) =>
    value === null ? "No data yet" : formatNumber(value, { decimals: 1, unit });

  return (
    <div className="space-y-8">
      <Section
        title="Glucose control"
        description={`Worked out from every reading recorded — ${rangeLabel}`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Average glucose" value={one(g.meanMgDl, "mg/dL")} hint={`${formatNumber(g.readings)} readings`} />
          <StatCard
            label="Time in range (70–180)"
            value={one(g.inRangePercent, "%")}
            hint="Share of readings in the healthy band"
          />
          <StatCard
            label="Below 70 (lows)"
            value={one(g.belowRangePercent, "%")}
            hint="Share of readings that were low"
          />
          <StatCard
            label="Above 180 (highs)"
            value={one(g.aboveRangePercent, "%")}
            hint="Share of readings that were high"
          />
          <StatCard
            label="Estimated HbA1c"
            value={one(g.gmiPercent, "%")}
            hint="Estimated from average glucose: 3.31 + 0.02392 × average"
          />
          <StatCard
            label="Glucose swings"
            value={one(g.cvPercent, "%")}
            hint="Standard deviation as a share of the average; under 36% is steady"
          />
          <StatCard label="Readings per day" value={one(g.readingsPerDay)} hint="How often this child records" />
        </div>
      </Section>

      <Section title="Insulin" description={`Worked out from every dose recorded — ${rangeLabel}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Average daily insulin" value={one(insulin.meanTotalDailyDose, "units")} />
          <StatCard
            label="Carbs covered by 1 unit"
            value={one(insulin.icRatioAtMeanTdd, "g")}
            hint="500 ÷ the average daily dose"
          />
          <StatCard
            label="Glucose lowered by 1 unit"
            value={one(insulin.isfAtMeanTdd, "mg/dL")}
            hint="1800 ÷ the average daily dose"
          />
          <StatCard label="Doses recorded" value={formatNumber(insulin.doses)} hint={rangeLabel} />
        </div>
      </Section>

      <Section title="Glucose readings over time" description={rangeLabel}>
        <TrendLineChart
          title="Glucose readings"
          unit="mg/dL"
          rangeLabel={rangeLabel}
          data={glucoseSeries}
          series={[{ key: "average", name: "This child's average", colour: "var(--color-chart-1)" }]}
          emptyTitle="No glucose readings"
          emptyDescription="No readings were recorded by this child during this time."
        />
      </Section>
    </div>
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

  const [overview, breakdown, glucoseSeries, research] = await Promise.all([
    getDashboardOverview(principal, resolved),
    getCohortBreakdown(principal),
    getAggregateGlucoseTrend({
      ...cohortScope,
      from: resolved.from,
      to: resolved.to,
      interval,
      unit: "MG_DL",
    }),
    getResearchStats({
      userIds: unrestricted ? null : userIds,
      from: resolved.from,
      to: resolved.to,
    }),
  ]);
  const g = research.glucose;
  const insulin = research.insulin;
  const one = (value: number | null, unit?: string) =>
    value === null ? "No data yet" : formatNumber(value, { decimals: 1, unit });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Children in the study" value={formatNumber(userIds.length)} />
        <StatCard
          label="Entries recorded"
          value={formatNumber(overview.activity.recordsLoggedInPeriod)}
          hint={rangeLabel}
        />
      </div>

      <Section
        title="Glucose control"
        description={`Worked out from every reading recorded — ${rangeLabel}`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Average glucose" value={one(g.meanMgDl, "mg/dL")} hint={`${formatNumber(g.readings)} readings`} />
          <StatCard
            label="Time in range (70–180)"
            value={one(g.inRangePercent, "%")}
            hint="Share of readings in the healthy band"
          />
          <StatCard
            label="Below 70 (lows)"
            value={one(g.belowRangePercent, "%")}
            hint="Share of readings that were low"
          />
          <StatCard
            label="Above 180 (highs)"
            value={one(g.aboveRangePercent, "%")}
            hint="Share of readings that were high"
          />
          <StatCard
            label="Estimated HbA1c"
            value={one(g.gmiPercent, "%")}
            hint="Estimated from average glucose: 3.31 + 0.02392 × average"
          />
          <StatCard
            label="Glucose swings"
            value={one(g.cvPercent, "%")}
            hint="Standard deviation as a share of the average; under 36% is steady"
          />
          <StatCard
            label="Readings per day"
            value={one(g.readingsPerDay)}
            hint="How often families record"
          />
          <StatCard
            label="Children recording"
            value={`${formatNumber(research.childrenLogging)} of ${formatNumber(research.childrenInScope)}`}
            hint="Recorded at least one reading"
          />
        </div>
      </Section>

      <Section
        title="Insulin"
        description={`Worked out from every dose recorded — ${rangeLabel}`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Average daily insulin per child"
            value={one(insulin.meanTotalDailyDose, "units")}
            hint={`${formatNumber(insulin.childrenWithDoses)} children logged doses`}
          />
          <StatCard
            label="Carbs covered by 1 unit"
            value={one(insulin.icRatioAtMeanTdd, "g")}
            hint="500 ÷ the average daily dose"
          />
          <StatCard
            label="Glucose lowered by 1 unit"
            value={one(insulin.isfAtMeanTdd, "mg/dL")}
            hint="1800 ÷ the average daily dose"
          />
          <StatCard label="Doses recorded" value={formatNumber(insulin.doses)} hint={rangeLabel} />
        </div>
      </Section>

      <Section title="Glucose readings over time" description={rangeLabel}>
        <TrendLineChart
          title="Glucose readings"
          unit="mg/dL"
          rangeLabel={rangeLabel}
          data={glucoseSeries}
          series={[
            {
              key: "average",
              name: "Average across all children",
              colour: "var(--color-chart-1)",
            },
          ]}
          emptyTitle="No glucose readings"
          emptyDescription="No readings were recorded by any child during this time."
        />
      </Section>

      <Section title="Who has signed up" description="Children currently in the study">
        <div className="grid gap-4 lg:grid-cols-3">
          <CategoryBars
            title="By type of diabetes"
            valueLabel="Children"
            data={breakdown.byDiabetesType.map((entry) => ({
              label: humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
          <CategoryBars
            title="By how they are treated"
            valueLabel="Children"
            data={breakdown.byTreatmentModality.map((entry) => ({
              label: humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
          <CategoryBars
            title="By sign-up status"
            valueLabel="Children"
            data={breakdown.byStatus.map((entry) => ({
              label: SIGN_UP_STATUS[entry.key] ?? humaniseEnum(entry.key),
              value: entry.count,
            }))}
          />
        </div>
      </Section>
    </div>
  );
}

/** What an account status means to the person reading the report. */
const SIGN_UP_STATUS: Record<string, string> = {
  PENDING: "Waiting to be approved",
  ACTIVE: "Signed up and using the app",
  INACTIVE: "No longer using the app",
  SUSPENDED: "Paused by the team",
};

function ReportsFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <ChartSkeleton />
      </Card>
    </div>
  );
}
