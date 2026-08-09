import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * A single headline figure.
 *
 * The delta is rendered in neutral ink by default. Colour is only applied when
 * the caller states, via `deltaMeaning`, that a direction is unambiguously good
 * or bad for that metric — enrolment rising is good, a missed-dose count rising
 * is not, and a glucose average moving is neither without a clinical threshold.
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  deltaMeaning = "neutral",
  hint,
  className,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  /** Percentage change against the preceding period. */
  delta?: number | null;
  deltaLabel?: string;
  deltaMeaning?: "higher-is-better" | "lower-is-better" | "neutral";
  hint?: string;
  className?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <Card className={cn("p-5", className)}>
      <p className="text-ink-muted text-xs font-medium">{label}</p>

      <p className="text-ink tabular mt-2 text-2xl leading-none font-semibold">
        {hasValue ? value : <span className="text-ink-subtle text-lg">—</span>}
        {hasValue && unit ? (
          <span className="text-ink-muted ml-1 text-sm font-normal">{unit}</span>
        ) : null}
      </p>

      {delta !== null && delta !== undefined ? (
        <Delta value={delta} label={deltaLabel} meaning={deltaMeaning} />
      ) : hint ? (
        <p className="text-ink-subtle mt-2 text-xs">{hint}</p>
      ) : (
        <p className="text-ink-subtle mt-2 text-xs">
          {hasValue ? " " : "No data for this period"}
        </p>
      )}
    </Card>
  );
}

function Delta({
  value,
  label,
  meaning,
}: {
  value: number;
  label?: string;
  meaning: "higher-is-better" | "lower-is-better" | "neutral";
}) {
  const rising = value > 0;
  const flat = value === 0;

  const tone =
    meaning === "neutral" || flat
      ? "text-ink-muted"
      : (rising && meaning === "higher-is-better") ||
          (!rising && meaning === "lower-is-better")
        ? "text-success"
        : "text-danger";

  const Icon = flat ? ArrowRight : rising ? ArrowUp : ArrowDown;

  return (
    <p className={cn("mt-2 flex items-center gap-1 text-xs", tone)}>
      <Icon className="size-3" aria-hidden="true" />
      <span className="tabular">
        {rising ? "+" : ""}
        {value}%
      </span>
      {label ? <span className="text-ink-subtle">{label}</span> : null}
    </p>
  );
}

/**
 * A compact label/value pair for detail panels — the right tool when a full
 * card would be visual noise.
 */
export function DataPoint({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 truncate text-[13px] font-medium">
        {value === null || value === undefined || value === "" ? (
          <span className="text-ink-subtle font-normal">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
