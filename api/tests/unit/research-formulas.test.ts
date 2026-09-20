import { describe, expect, it } from "vitest";

import { summariseGlucose, summariseInsulin } from "@/lib/services/research-formulas";

describe("research glucose figures", () => {
  it("works out mean, range shares and the HbA1c estimate", () => {
    // 60 low, 100 and 150 in range, 250 high → mean 140.
    const s = summariseGlucose(
      [60, 100, 150, 250].map((value) => ({ value, unit: "MG_DL" })),
      2,
    );
    expect(s.readings).toBe(4);
    expect(s.meanMgDl).toBe(140);
    expect(s.belowRangePercent).toBe(25);
    expect(s.inRangePercent).toBe(50);
    expect(s.aboveRangePercent).toBe(25);
    // 3.31 + 0.02392 × 140
    expect(s.gmiPercent).toBeCloseTo(6.6588, 4);
    expect(s.readingsPerDay).toBe(2);
  });

  it("brings mmol/L readings to mg/dL before averaging", () => {
    const s = summariseGlucose([{ value: 10, unit: "MMOL_L" }], 1);
    expect(s.meanMgDl).toBeCloseTo(180.182, 3);
  });

  it("reports nothing rather than zeros when there are no readings", () => {
    const s = summariseGlucose([], 30);
    expect(s.meanMgDl).toBeNull();
    expect(s.inRangePercent).toBeNull();
    expect(s.gmiPercent).toBeNull();
  });
});

describe("research insulin figures", () => {
  const at = (day: string) => new Date(`${day}T08:00:00Z`);

  it("averages each child's daily totals, then the children", () => {
    const s = summariseInsulin([
      // child a: day 1 = 20, day 2 = 30 → 25
      { userId: "a", doseUnits: 12, administeredAt: at("2026-09-01") },
      { userId: "a", doseUnits: 8, administeredAt: at("2026-09-01") },
      { userId: "a", doseUnits: 30, administeredAt: at("2026-09-02") },
      // child b: one day of 15
      { userId: "b", doseUnits: 15, administeredAt: at("2026-09-01") },
    ]);
    expect(s.childrenWithDoses).toBe(2);
    expect(s.meanTotalDailyDose).toBe(20);
    expect(s.icRatioAtMeanTdd).toBe(25);
    expect(s.isfAtMeanTdd).toBe(90);
  });

  it("gives no ratios when nothing was logged", () => {
    const s = summariseInsulin([]);
    expect(s.meanTotalDailyDose).toBeNull();
    expect(s.icRatioAtMeanTdd).toBeNull();
  });
});
