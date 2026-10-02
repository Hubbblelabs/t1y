import { describe, expect, it } from "vitest";

import { ageInYears, average, bmi, dayKey, diarySlotFor, toMgDl } from "@/lib/patient-diary";

describe("patient diary helpers", () => {
  it("computes age in whole years, minding the birthday", () => {
    const dob = new Date("2014-10-05T00:00:00Z");
    expect(ageInYears(dob, new Date("2026-10-04T00:00:00Z"))).toBe(11);
    expect(ageInYears(dob, new Date("2026-10-05T00:00:00Z"))).toBe(12);
    expect(ageInYears(null)).toBeNull();
    expect(ageInYears(new Date("2030-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBeNull();
  });

  it("computes BMI to one decimal and refuses unusable input", () => {
    expect(bmi(150, 45)).toBe(20);
    expect(bmi(142, 38.5)).toBe(19.1);
    expect(bmi(null, 40)).toBeNull();
    expect(bmi(150, 0)).toBeNull();
  });

  it("puts a moment on the child's own calendar day", () => {
    // 20:00 UTC on 2 Oct is already 3 Oct in India.
    const at = new Date("2026-10-02T20:00:00Z");
    expect(dayKey(at, "Asia/Kolkata")).toBe("2026-10-03");
    expect(dayKey(at, "UTC")).toBe("2026-10-02");
    expect(dayKey(at, "Not/AZone")).toBe("2026-10-02");
  });

  it("places readings into diary columns", () => {
    expect(diarySlotFor({ slot: "POST_LUNCH", context: "POST_MEAL" })).toBe("POST_LUNCH");
    expect(diarySlotFor({ slot: null, context: "FASTING" })).toBe("PRE_BREAKFAST");
    expect(diarySlotFor({ slot: null, context: "RANDOM" })).toBeNull();
  });

  it("converts and averages", () => {
    expect(Math.round(toMgDl(5.5, "MMOL_L"))).toBe(99);
    expect(toMgDl(120, "MG_DL")).toBe(120);
    expect(average([100, 101])).toBe(100.5);
    expect(average([])).toBeNull();
  });
});
