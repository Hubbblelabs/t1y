import { StatCard } from "@/components/admin/stat-card";
import { Section } from "@/components/admin/page-header";
import { CategoryBars, TrendBarChart, TrendLineChart } from "@/components/charts/trend-charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { getGlucoseSummary, getGlucoseTrend } from "@/lib/services/glucose";
import { getHbA1cSummary } from "@/lib/services/hba1c";
import { getMetricSeriesForParticipant } from "@/lib/services/health-metrics";
import {
  getExerciseSummary,
  getWeekdayDistribution,
} from "@/lib/services/exercise";
import { getInsulinSummary } from "@/lib/services/insulin";
import {
  getAdherenceByMedication,
  getAdherenceSummary,
} from "@/lib/services/medications";
import { getNutritionSummary, getNutritionTrend } from "@/lib/services/meals";
import { resolveThresholdsForParticipant } from "@/lib/services/thresholds";
import {
  DATE_RANGE_LABELS,
  resolveDateRange,
  type DateRangeInput,
} from "@/lib/validation/common";
import {
  describeTrend,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  humaniseEnum,
} from "@/lib/utils/format";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * All health-data sections for one participant.
 *
 * Values are presented descriptively. Where a clinician has configured a
 * threshold, the target range is shown alongside the figure; where none exists,
 * the number stands on its own without any implied verdict.
 */
export async function ParticipantHealth({
  userId,
  range,
}: {
  userId: string;
  range: DateRangeInput;
}) {
  const { from, to } = resolveDateRange(range);
  const rangeLabel = DATE_RANGE_LABELS[range.range];
  const interval = range.range === "1y" || range.range === "6m" ? "week" : "day";
  const window = { userId, from, to };

  const [
    glucose,
    glucoseSeries,
    adherence,
    byMedication,
    insulin,
    nutrition,
    nutritionSeries,
    exercise,
    weekday,
    hba1c,
    metrics,
    thresholds,
  ] = await Promise.all([
    getGlucoseSummary({ ...window, unit: "MG_DL" }),
    getGlucoseTrend({ ...window, interval, unit: "MG_DL" }),
    getAdherenceSummary(window),
    getAdherenceByMedication(window),
    getInsulinSummary(window),
    getNutritionSummary(window),
    getNutritionTrend({ ...window, interval }),
    getExerciseSummary(window),
    getWeekdayDistribution(window),
    getHbA1cSummary({ userId }),
    getMetricSeriesForParticipant(window),
    resolveThresholdsForParticipant(userId),
  ]);

  const glucoseThreshold = thresholds.find((entry) => entry.domain === "glucose");

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      <Section title="Glucose" description={`${rangeLabel} · recorded readings`}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Readings" value={formatNumber(glucose.count)} />
          <StatCard
            label="Average"
            value={glucose.average}
            unit="mg/dL"
            hint={describeTrend(glucose.trend)}
          />
          <StatCard label="Lowest recorded" value={glucose.minimum} unit="mg/dL" />
          <StatCard label="Highest recorded" value={glucose.maximum} unit="mg/dL" />
        </div>

        {glucoseThreshold ? (
          <p className="text-ink-muted mb-3 text-xs">
            Configured target range: {glucoseThreshold.lowValue ?? "—"}–
            {glucoseThreshold.highValue ?? "—"} {glucoseThreshold.unit}{" "}
            <span className="text-ink-subtle">({glucoseThreshold.source})</span>
          </p>
        ) : (
          <p className="text-ink-subtle mb-3 text-xs">
            No target range has been configured for this participant, so readings
            are shown without a reference band.
          </p>
        )}

        <TrendLineChart
          title="Glucose readings over time"
          unit="mg/dL"
          rangeLabel={rangeLabel}
          data={glucoseSeries}
          series={[
            { key: "average", name: "Average", colour: "var(--color-chart-1)" },
            { key: "minimum", name: "Lowest", colour: "var(--color-chart-3)" },
            { key: "maximum", name: "Highest", colour: "var(--color-chart-4)" },
          ]}
          emptyTitle="No glucose records yet"
          emptyDescription="There are no glucose readings for this participant during the selected period."
        />

        {glucose.contextDistribution.length > 0 ? (
          <div className="mt-4">
            <CategoryBars
              title="Readings by context"
              description="When readings were taken"
              valueLabel="Readings"
              data={glucose.contextDistribution.map((entry) => ({
                label: humaniseEnum(entry.context),
                value: entry.count,
              }))}
            />
          </div>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Medication" description={`${rangeLabel} · scheduled doses`}>
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="p-5">
            <p className="text-ink-muted text-xs font-medium">Adherence</p>
            <p className="text-ink tabular mt-2 text-3xl leading-none font-semibold">
              {formatPercent(adherence.adherencePercent, 0)}
            </p>
            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Taken</dt>
                <dd className="text-ink tabular font-medium">{adherence.taken}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Missed</dt>
                <dd className="text-ink tabular font-medium">{adherence.missed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Skipped</dt>
                <dd className="text-ink tabular font-medium">{adherence.skipped}</dd>
              </div>
            </dl>
            <p className="text-ink-subtle mt-3 text-xs">
              Calculated from doses that have come due. Pending doses are excluded.
            </p>
          </Card>

          <Card>
            {byMedication.length === 0 ? (
              <EmptyState
                title="No medication activity"
                description="No doses were scheduled or logged during this period."
              />
            ) : (
              <TableScroll label="Adherence by medication">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead className="text-right">Taken</TableHead>
                      <TableHead className="text-right">Missed</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead className="text-right">Adherence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byMedication.map((entry) => (
                      <TableRow key={entry.medication.id}>
                        <TableCell>
                          <span className="font-medium">{entry.medication.name}</span>
                          <span className="text-ink-subtle ml-1.5 text-xs">
                            {entry.medication.dosageText}
                          </span>
                          {!entry.medication.isActive ? (
                            <Badge tone="neutral" className="ml-2">
                              Discontinued
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular text-right">{entry.taken}</TableCell>
                        <TableCell className="tabular text-right">{entry.missed}</TableCell>
                        <TableCell className="tabular text-right">{entry.skipped}</TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatPercent(entry.adherencePercent, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            )}
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Insulin"
        description={`${rangeLabel} · recorded administrations. The platform does not calculate or recommend doses.`}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Records" value={formatNumber(insulin.recordCount)} />
          <StatCard label="Total recorded" value={insulin.totalUnits} unit="IU" />
          <StatCard label="Average per record" value={insulin.averageUnitsPerRecord} unit="IU" />
          <StatCard label="Average per day" value={insulin.averageUnitsPerDay} unit="IU" />
        </div>

        {insulin.byType.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <CategoryBars
              title="By insulin type"
              valueLabel="Records"
              data={insulin.byType.map((entry) => ({
                label: humaniseEnum(entry.insulinType),
                value: entry.count,
              }))}
            />
            <CategoryBars
              title="By injection site"
              description="Site rotation as recorded by the participant"
              valueLabel="Records"
              data={insulin.bySite.map((entry) => ({
                label: humaniseEnum(entry.site),
                value: entry.count,
              }))}
            />
          </div>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Nutrition"
        description={`${rangeLabel} · ${nutrition.mealsWithNutritionSource} of ${nutrition.mealCount} meals reference a nutrition database`}
      >
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Meals logged" value={formatNumber(nutrition.mealCount)} />
          <StatCard label="Meals per day" value={nutrition.mealsPerDay} />
          <StatCard
            label="Carbohydrate per day"
            value={nutrition.averageCarbsPerDay}
            unit="g"
            hint="Participant-reported"
          />
          <StatCard
            label="Carbohydrate per meal"
            value={nutrition.averageCarbsPerMeal}
            unit="g"
            hint="Participant-reported"
          />
        </div>

        <TrendBarChart
          title="Carbohydrate recorded"
          description="Participant-reported values; not a validated nutritional analysis"
          unit="grams"
          rangeLabel={rangeLabel}
          height={220}
          data={nutritionSeries}
          series={[{ key: "carbsGrams", name: "Carbohydrate", colour: "var(--color-chart-4)" }]}
          emptyTitle="No meals logged"
          emptyDescription="This participant has not recorded meals in the selected period."
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Exercise" description={`${rangeLabel} · logged sessions`}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sessions" value={formatNumber(exercise.sessionCount)} />
          <StatCard label="Total time" value={formatDuration(exercise.totalMinutes)} />
          <StatCard
            label="Average session"
            value={formatDuration(exercise.averageMinutesPerSession)}
          />
          <StatCard
            label="Weekly average"
            value={formatDuration(exercise.averageMinutesPerWeek)}
          />
        </div>

        <TrendBarChart
          title="Exercise by day of week"
          description="Total minutes across the period"
          unit="minutes"
          rangeLabel={rangeLabel}
          height={220}
          data={weekday.map((entry) => ({
            bucket: WEEKDAY_LABELS[entry.weekday] ?? "",
            minutes: entry.minutes,
          }))}
          xFormatter="identity"
          series={[{ key: "minutes", name: "Minutes", colour: "var(--color-chart-2)" }]}
          emptyTitle="No exercise recorded"
          emptyDescription="No sessions were logged during this period."
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="HbA1c" description="All recorded results">
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Latest"
            value={hba1c.latest?.valuePercent ?? null}
            unit="%"
            hint={hba1c.latest ? formatDate(hba1c.latest.measuredAt) : undefined}
          />
          <StatCard
            label="Previous"
            value={hba1c.previous?.valuePercent ?? null}
            unit="%"
            hint={hba1c.previous ? formatDate(hba1c.previous.measuredAt) : undefined}
          />
          <StatCard
            label="Change"
            value={
              hba1c.changePercentagePoints === null
                ? null
                : `${hba1c.changePercentagePoints > 0 ? "+" : ""}${hba1c.changePercentagePoints}`
            }
            unit="pp"
            hint={
              hba1c.daysBetweenLastTwo
                ? `Over ${hba1c.daysBetweenLastTwo} days`
                : "Needs two results"
            }
          />
          <StatCard label="Results recorded" value={formatNumber(hba1c.recordCount)} />
        </div>

        <TrendLineChart
          title="HbA1c over time"
          unit="%"
          rangeLabel="All recorded results"
          height={220}
          data={hba1c.history.map((point) => ({
            bucket: point.measuredAt,
            valuePercent: point.valuePercent,
          }))}
          series={[{ key: "valuePercent", name: "HbA1c", colour: "var(--color-chart-5)" }]}
          emptyTitle="No HbA1c results"
          emptyDescription="No results have been recorded for this participant."
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Health metrics" description={`${rangeLabel} · tracked measurements`}>
        {metrics.length === 0 ? (
          <Card>
            <EmptyState
              title="No health metrics recorded"
              description="Weight, blood pressure and other metrics appear here once the participant records them."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {metrics.map((metric) => (
              <TrendLineChart
                key={metric.definition.id}
                title={metric.definition.label}
                unit={metric.definition.unit}
                rangeLabel={rangeLabel}
                height={200}
                description={
                  metric.latest
                    ? `Latest ${metric.latest.value ?? "—"}${
                        metric.definition.valueType === "COMPOSITE" &&
                        metric.latest.secondaryValue !== null
                          ? `/${metric.latest.secondaryValue}`
                          : ""
                      } ${metric.definition.unit}`
                    : undefined
                }
                data={metric.points.map((point) => ({
                  bucket: point.measuredAt,
                  value: point.value,
                  secondaryValue: point.secondaryValue,
                }))}
                series={
                  metric.definition.valueType === "COMPOSITE"
                    ? [
                        {
                          key: "value",
                          name: metric.definition.primaryLabel ?? "Primary",
                          colour: "var(--color-chart-1)",
                        },
                        {
                          key: "secondaryValue",
                          name: metric.definition.secondaryLabel ?? "Secondary",
                          colour: "var(--color-chart-2)",
                        },
                      ]
                    : [
                        {
                          key: "value",
                          name: metric.definition.label,
                          colour: "var(--color-chart-1)",
                        },
                      ]
                }
                emptyTitle={`No ${metric.definition.label.toLowerCase()} records`}
                emptyDescription="Nothing was recorded for this metric during the selected period."
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
