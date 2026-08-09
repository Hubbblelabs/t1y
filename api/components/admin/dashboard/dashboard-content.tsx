import Link from "next/link";

import { RecentActivityPanel } from "@/components/admin/dashboard/recent-activity";
import { Section } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { TrendBarChart, TrendLineChart } from "@/components/charts/trend-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { getDashboardCharts, getDashboardOverview } from "@/lib/services/analytics";
import {
  DATE_RANGE_LABELS,
  resolveDateRange,
  type DateRangeInput,
} from "@/lib/validation/common";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils/format";

/**
 * Dashboard body — a Server Component, so the aggregate queries run on the
 * server and no participant data is serialised into the client bundle beyond
 * what is rendered.
 */
export async function DashboardContent({ range }: { range: DateRangeInput }) {
  const principal = await requirePrincipal();
  const resolved = resolveDateRange(range);
  const rangeLabel = DATE_RANGE_LABELS[range.range];

  // A month-long window reads better bucketed daily; a year does not.
  const interval = range.range === "1y" || range.range === "6m" ? "week" : "day";

  const [overview, charts] = await Promise.all([
    getDashboardOverview(principal, resolved),
    getDashboardCharts(principal, resolved, interval),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total participants"
          value={formatNumber(overview.participants.total)}
          hint={`${formatNumber(overview.participants.pending)} pending activation`}
        />
        <StatCard
          label="Active participants"
          value={formatNumber(overview.participants.active)}
          delta={overview.participants.newChangePercent}
          deltaLabel="new sign-ups vs previous period"
          deltaMeaning="higher-is-better"
        />
        <StatCard
          label="Records logged"
          value={formatNumber(overview.activity.recordsLoggedInPeriod)}
          hint={`${formatNumber(overview.activity.recordsLoggedToday)} today · ${formatNumber(overview.activity.participantsLoggingToday)} participants`}
        />
        <StatCard
          label="Medication adherence"
          value={formatPercent(overview.adherence.percent, 1)}
          hint={
            overview.adherence.percent === null
              ? "No doses came due in this period"
              : `${formatNumber(overview.adherence.taken)} taken · ${formatNumber(overview.adherence.missed)} missed`
          }
        />
      </div>

      <TrendLineChart
        title="Glucose readings"
        description="Cohort average of all recorded readings"
        unit="mg/dL"
        rangeLabel={rangeLabel}
        data={charts.glucoseSeries}
        series={[
          { key: "average", name: "Average", colour: "var(--color-chart-1)" },
          { key: "minimum", name: "Lowest", colour: "var(--color-chart-3)" },
          { key: "maximum", name: "Highest", colour: "var(--color-chart-4)" },
        ]}
        emptyTitle="No glucose readings recorded"
        emptyDescription="No participant logged a glucose reading during the selected period. Try widening the date range."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <TrendBarChart
          title="Exercise activity"
          description="Total minutes logged across the cohort"
          unit="minutes"
          rangeLabel={rangeLabel}
          height={240}
          className="lg:col-span-3"
          data={charts.exerciseSeries}
          series={[{ key: "minutes", name: "Minutes", colour: "var(--color-chart-2)" }]}
          emptyTitle="No exercise recorded"
          emptyDescription="No sessions were logged in this period."
        />

        <div className="lg:col-span-2">
          <RecentActivityPanel entries={charts.recentActivity} />
        </div>
      </div>

      <Section
        title="Latest HbA1c results"
        description="Most recent laboratory results across the cohort"
      >
        <Card>
          {charts.recentHbA1c.length === 0 ? (
            <EmptyState
              title="No HbA1c results yet"
              description="Results appear here as participants or clinicians record them."
            />
          ) : (
            <ul className="divide-line divide-y">
              {charts.recentHbA1c.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/participants/${record.user.id}`}
                      className="text-ink hover:text-primary truncate text-[13px] font-medium underline-offset-4 hover:underline"
                    >
                      {record.user.profile?.participantCode ?? "Unknown"}
                    </Link>
                    <p className="text-ink-subtle text-xs">
                      {formatDate(record.measuredAt)}
                    </p>
                  </div>
                  {/* Neutral presentation: the figure is reported, not judged. */}
                  <Badge tone="neutral" className="tabular">
                    {record.valuePercent}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>
    </div>
  );
}

export function DashboardHeadingCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
