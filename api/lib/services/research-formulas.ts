/**
 * The arithmetic behind the research team's periodic figures. Pure functions
 * with no database, so each formula can be tested against a worked example.
 */

/** mmol/L → mg/dL, the same constant the calculators use. */
const MMOL_TO_MG_DL = 18.0182;

/** The consensus "in range" band for children, and the low/high cut-offs. */
export const RANGE_LOW = 70;
export const RANGE_HIGH = 180;

export interface GlucoseSummary {
  readings: number;
  /** Mean of every reading, mg/dL. Null when there are none. */
  meanMgDl: number | null;
  /** Standard deviation, mg/dL. */
  sdMgDl: number | null;
  /** Coefficient of variation, percent: SD ÷ mean × 100. */
  cvPercent: number | null;
  /** Share of readings 70–180 mg/dL, percent. */
  inRangePercent: number | null;
  belowRangePercent: number | null;
  aboveRangePercent: number | null;
  /**
   * Glucose Management Indicator — an estimate of HbA1c from average glucose:
   * GMI(%) = 3.31 + 0.02392 × mean glucose (mg/dL). An estimate for the
   * report, not a lab result.
   */
  gmiPercent: number | null;
  /** Readings per child-day is not known here; this is readings per day overall. */
  readingsPerDay: number | null;
}

export function summariseGlucose(
  readings: Array<{ value: number; unit: "MG_DL" | "MMOL_L" | string }>,
  days: number,
): GlucoseSummary {
  const values = readings.map((r) => (r.unit === "MMOL_L" ? r.value * MMOL_TO_MG_DL : r.value));
  if (values.length === 0) {
    return {
      readings: 0,
      meanMgDl: null,
      sdMgDl: null,
      cvPercent: null,
      inRangePercent: null,
      belowRangePercent: null,
      aboveRangePercent: null,
      gmiPercent: null,
      readingsPerDay: null,
    };
  }

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const pct = (count: number) => (count / n) * 100;

  return {
    readings: n,
    meanMgDl: mean,
    sdMgDl: sd,
    cvPercent: (sd / mean) * 100,
    inRangePercent: pct(values.filter((v) => v >= RANGE_LOW && v <= RANGE_HIGH).length),
    belowRangePercent: pct(values.filter((v) => v < RANGE_LOW).length),
    aboveRangePercent: pct(values.filter((v) => v > RANGE_HIGH).length),
    gmiPercent: 3.31 + 0.02392 * mean,
    readingsPerDay: n / Math.max(1, days),
  };
}

export interface InsulinSummary {
  doses: number;
  childrenWithDoses: number;
  /**
   * Average total daily dose per child: for each child, the mean over the
   * days they logged of that day's total; then the mean across children.
   */
  meanTotalDailyDose: number | null;
  /** 500 ÷ mean TDD — the insulin-to-carb rule applied to the group average. */
  icRatioAtMeanTdd: number | null;
  /** 1800 ÷ mean TDD — the rapid-acting correction rule on the group average. */
  isfAtMeanTdd: number | null;
}

export function summariseInsulin(
  doses: Array<{ userId: string; doseUnits: number; administeredAt: Date }>,
): InsulinSummary {
  // day total per child
  const perChildDay = new Map<string, Map<string, number>>();
  for (const dose of doses) {
    const day = dose.administeredAt.toISOString().slice(0, 10);
    const days = perChildDay.get(dose.userId) ?? new Map<string, number>();
    days.set(day, (days.get(day) ?? 0) + dose.doseUnits);
    perChildDay.set(dose.userId, days);
  }

  const childMeans = [...perChildDay.values()].map((days) => {
    const totals = [...days.values()];
    return totals.reduce((a, b) => a + b, 0) / totals.length;
  });

  const mean = childMeans.length ? childMeans.reduce((a, b) => a + b, 0) / childMeans.length : null;

  return {
    doses: doses.length,
    childrenWithDoses: childMeans.length,
    meanTotalDailyDose: mean,
    icRatioAtMeanTdd: mean && mean > 0 ? 500 / mean : null,
    isfAtMeanTdd: mean && mean > 0 ? 1800 / mean : null,
  };
}
