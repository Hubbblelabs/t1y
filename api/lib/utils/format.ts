/**
 * Display formatting.
 *
 * Shared between server and client components, so nothing here may import
 * `server-only` or touch the database.
 *
 * Absent values render as an em dash rather than "0" or "N/A": a missing
 * reading is not a zero reading, and the distinction matters in a health record.
 */

const EM_DASH = "—";

export function formatNumber(
  value: number | null | undefined,
  options?: { decimals?: number; unit?: string },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;

  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: options?.decimals ?? 0,
    maximumFractionDigits: options?.decimals ?? 0,
  }).format(value);

  return options?.unit ? `${formatted} ${options.unit}` : formatted;
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return EM_DASH;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return EM_DASH;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return EM_DASH;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Compact axis label: "09 Aug". */
export function formatChartDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

/** "3 days ago", "just now". Used for last-activity columns. */
export function formatRelative(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return EM_DASH;

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(deltaSeconds);

  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  if (absolute < 60) return formatter.format(deltaSeconds, "second");
  if (absolute < 3600) return formatter.format(Math.round(deltaSeconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(deltaSeconds / 3600), "hour");
  if (absolute < 2_592_000)
    return formatter.format(Math.round(deltaSeconds / 86_400), "day");
  if (absolute < 31_536_000)
    return formatter.format(Math.round(deltaSeconds / 2_592_000), "month");
  return formatter.format(Math.round(deltaSeconds / 31_536_000), "year");
}

/** "PRE_MEAL" → "Pre meal". Used for every enum shown in the interface. */
export function humaniseEnum(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatGlucoseUnit(unit: "MG_DL" | "MMOL_L" | string): string {
  return unit === "MMOL_L" ? "mmol/L" : "mg/dL";
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return EM_DASH;
  }
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

/**
 * Neutral wording for a direction of travel.
 *
 * Deliberately avoids "improved" / "worsened": whether a change is good
 * depends on clinical context this layer does not have.
 */
export function describeTrend(
  direction: "increasing" | "decreasing" | "stable" | "insufficient-data",
): string {
  switch (direction) {
    case "increasing":
      return "Higher than the previous period";
    case "decreasing":
      return "Lower than the previous period";
    case "stable":
      return "Similar to the previous period";
    default:
      return "Not enough data to compare";
  }
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export { EM_DASH };
