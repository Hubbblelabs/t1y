"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";

/**
 * Common wrapper for every chart.
 *
 * Enforces the things a chart in this product must always have: a title, the
 * period it covers, its units, and explicit empty/loading/error states. A chart
 * that silently renders nothing is worse than one that says why.
 */
export function ChartFrame({
  title,
  description,
  unit,
  rangeLabel,
  isEmpty,
  isLoading,
  error,
  emptyTitle = "No data for this period",
  emptyDescription = "There are no records in the selected date range. Try widening the range.",
  actions,
  height = 280,
  children,
  className,
}: {
  title: string;
  description?: string;
  unit?: string;
  rangeLabel?: string;
  isEmpty?: boolean;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="text-ink text-sm font-semibold">{title}</h3>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {[rangeLabel, unit ? `Measured in ${unit}` : null, description]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <div className="px-3 pt-1 pb-4">
        {isLoading ? (
          <ChartSkeleton height={height} />
        ) : error ? (
          <ErrorState detail={error} />
        ) : isEmpty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
    </Card>
  );
}

/**
 * Tooltip shared by every chart, so number formatting and layout stay
 * consistent across the dashboard.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string | number;
  unit?: string;
  labelFormatter?: (value: string | number) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border-line min-w-36 rounded-md border p-2.5 shadow-lg">
      {label !== undefined ? (
        <p className="text-ink-muted mb-1.5 text-xs font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li
            key={`${entry.dataKey ?? entry.name ?? index}`}
            className="flex items-center gap-2 text-xs"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-muted flex-1">{entry.name}</span>
            <span className="text-ink tabular font-medium">
              {entry.value ?? "—"}
              {unit ? ` ${unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A table of the plotted values, hidden visually but available to screen
 * readers. Recharts output is not meaningfully navigable otherwise.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell ?? "no data"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const CHART_COLOURS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

/** Shared Recharts axis/grid styling. */
export const axisProps = {
  stroke: "var(--color-line-strong)",
  tick: { fill: "var(--color-ink-subtle)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "var(--color-line)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;
