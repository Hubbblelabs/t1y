"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  axisProps,
  ChartDataTable,
  ChartFrame,
  ChartTooltip,
  gridProps,
} from "@/components/charts/chart-frame";
import { formatChartDate } from "@/lib/utils/format";

/**
 * The chart vocabulary used across the dashboard.
 *
 * Line for a value over time, bar for counts and durations, area only where a
 * cumulative sense is genuinely intended. No 3-D, no gradients for decoration,
 * no animated entrances — these charts are read, not watched.
 */

/**
 * A plotted point. Kept generic rather than using an index signature, because
 * a TypeScript `interface` (which every service return type is) is not
 * assignable to `Record<string, …>`.
 */
export type SeriesPoint = { bucket: string };

/** Reads an arbitrary series key off a point without widening the caller's type. */
function valueAt(point: object, key: string): string | number | null {
  const value = (point as Record<string, unknown>)[key];
  if (typeof value === "string" || typeof value === "number") return value;
  return null;
}

interface BaseProps<T> {
  title: string;
  description?: string;
  unit?: string;
  rangeLabel?: string;
  data: readonly T[];
  isLoading?: boolean;
  error?: string | null;
  height?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TrendLineChart<T extends SeriesPoint>({
  series,
  ...props
}: BaseProps<T> & {
  series: Array<{ key: string; name: string; colour: string }>;
}) {
  const isEmpty = props.data.length === 0;

  return (
    <ChartFrame {...props} isEmpty={isEmpty}>
      <>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data as T[]} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="bucket" tickFormatter={formatChartDate} {...axisProps} />
            <YAxis width={48} {...axisProps} />
            <Tooltip
              content={
                <ChartTooltip unit={props.unit} labelFormatter={(v) => formatChartDate(String(v))} />
              }
              cursor={{ stroke: "var(--color-line-strong)" }}
            />
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stroke={entry.colour}
                strokeWidth={1.75}
                dot={false}
                // Gaps mean "no reading", not zero — do not bridge them.
                connectNulls={false}
                isAnimationActive={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <ChartDataTable
          caption={`${props.title}${props.unit ? ` in ${props.unit}` : ""}`}
          columns={["Period", ...series.map((entry) => entry.name)]}
          rows={props.data.map((point) => [
            formatChartDate(point.bucket),
            ...series.map((entry) => valueAt(point, entry.key)),
          ])}
        />
      </>
    </ChartFrame>
  );
}

/**
 * A named formatting mode rather than a function prop.
 *
 * `TrendBarChart` is rendered from Server Components (see
 * components/admin/participants/participant-health.tsx) — a function value
 * can't cross that boundary as a prop ("Functions cannot be passed directly
 * to Client Components"), the same class of bug the icon-prop fix in
 * lib/navigation.ts already worked around once. `"identity"` is for
 * already-labelled categories (weekday names, etc.) where running the value
 * through `formatChartDate` would try to parse "Mon" as a date and blank it.
 */
const X_FORMATTERS: Record<"date" | "identity", (value: string) => string> = {
  date: formatChartDate,
  identity: (value) => value,
};

export function TrendBarChart<T extends SeriesPoint>({
  series,
  xKey = "bucket",
  xFormatter = "date",
  ...props
}: BaseProps<T> & {
  series: Array<{ key: string; name: string; colour: string }>;
  xKey?: string;
  xFormatter?: "date" | "identity";
}) {
  const isEmpty = props.data.length === 0;
  const formatX = X_FORMATTERS[xFormatter];

  return (
    <ChartFrame {...props} isEmpty={isEmpty}>
      <>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={props.data as T[]} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} tickFormatter={formatX} {...axisProps} />
            <YAxis width={48} allowDecimals={false} {...axisProps} />
            <Tooltip
              content={
                <ChartTooltip unit={props.unit} labelFormatter={(v) => formatX(String(v))} />
              }
              cursor={{ fill: "var(--color-surface-hover)" }}
            />
            {series.map((entry) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.name}
                fill={entry.colour}
                radius={[3, 3, 0, 0]}
                maxBarSize={42}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <ChartDataTable
          caption={`${props.title}${props.unit ? ` in ${props.unit}` : ""}`}
          columns={["Period", ...series.map((entry) => entry.name)]}
          rows={props.data.map((point) => [
            formatX(String(valueAt(point, xKey) ?? "")),
            ...series.map((entry) => valueAt(point, entry.key)),
          ])}
        />
      </>
    </ChartFrame>
  );
}

export function TrendAreaChart<T extends SeriesPoint>({
  series,
  ...props
}: BaseProps<T> & {
  series: Array<{ key: string; name: string; colour: string }>;
}) {
  const isEmpty = props.data.length === 0;

  return (
    <ChartFrame {...props} isEmpty={isEmpty}>
      <>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={props.data as T[]} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="bucket" tickFormatter={formatChartDate} {...axisProps} />
            <YAxis width={48} {...axisProps} />
            <Tooltip
              content={
                <ChartTooltip unit={props.unit} labelFormatter={(v) => formatChartDate(String(v))} />
              }
              cursor={{ stroke: "var(--color-line-strong)" }}
            />
            {series.map((entry) => (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stroke={entry.colour}
                fill={entry.colour}
                fillOpacity={0.1}
                strokeWidth={1.75}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>

        <ChartDataTable
          caption={`${props.title}${props.unit ? ` in ${props.unit}` : ""}`}
          columns={["Period", ...series.map((entry) => entry.name)]}
          rows={props.data.map((point) => [
            formatChartDate(point.bucket),
            ...series.map((entry) => valueAt(point, entry.key)),
          ])}
        />
      </>
    </ChartFrame>
  );
}

/**
 * Horizontal bars for a small categorical breakdown.
 *
 * Preferred over a pie chart: length is easier to compare than angle, and the
 * counts stay legible.
 */
export function CategoryBars({
  title,
  description,
  data,
  valueLabel = "Records",
  isLoading,
  className,
}: {
  title: string;
  description?: string;
  data: Array<{ label: string; value: number }>;
  valueLabel?: string;
  isLoading?: boolean;
  className?: string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const max = Math.max(1, ...data.map((entry) => entry.value));

  return (
    <ChartFrame
      title={title}
      description={description}
      isEmpty={total === 0}
      isLoading={isLoading}
      height={Math.max(140, data.length * 34)}
      className={className}
    >
      <ul className="flex h-full flex-col justify-center gap-2.5 px-2">
        {data.map((entry) => (
          <li key={entry.label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
            <span className="text-ink-muted truncate text-xs" title={entry.label}>
              {entry.label}
            </span>
            <span className="bg-surface-sunken h-2 overflow-hidden rounded-full">
              <span
                className="bg-chart-1 block h-full rounded-full"
                style={{ width: `${(entry.value / max) * 100}%` }}
              />
            </span>
            <span className="text-ink tabular text-right text-xs font-medium">
              {entry.value}
            </span>
          </li>
        ))}
      </ul>

      <ChartDataTable
        caption={title}
        columns={["Category", valueLabel]}
        rows={data.map((entry) => [entry.label, entry.value])}
      />
    </ChartFrame>
  );
}
