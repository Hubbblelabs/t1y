import { describe, expect, it } from "vitest";

import {
  createGlucoseSchema,
  createHbA1cSchema,
  createInsulinLogSchema,
  createMedicationLogSchema,
  createMedicationSchema,
  createReminderSchema,
} from "@/lib/validation/health";
import {
  createThresholdSchema,
  exportRequestSchema,
} from "@/lib/validation/admin";
import {
  dateRangeSchema,
  paginationSchema,
  resolveDateRange,
  timeOfDaySchema,
} from "@/lib/validation/common";

const nowIso = () => new Date(Date.now() - 60_000).toISOString();

/**
 * Input validation.
 *
 * The backend is the final authority on every payload — the Flutter client
 * validating a field first changes nothing here.
 */
describe("glucose validation", () => {
  it("accepts a plausible mg/dL reading", () => {
    const result = createGlucoseSchema.safeParse({
      value: 126,
      unit: "MG_DL",
      context: "FASTING",
      measuredAt: nowIso(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a value outside the physiological range for its unit", () => {
    const result = createGlucoseSchema.safeParse({
      value: 1500,
      unit: "MG_DL",
      measuredAt: nowIso(),
    });
    expect(result.success).toBe(false);
  });

  it("applies unit-specific bounds rather than one shared range", () => {
    // 126 is ordinary in mg/dL but impossible in mmol/L.
    const asMgDl = createGlucoseSchema.safeParse({
      value: 126,
      unit: "MG_DL",
      measuredAt: nowIso(),
    });
    const asMmol = createGlucoseSchema.safeParse({
      value: 126,
      unit: "MMOL_L",
      measuredAt: nowIso(),
    });

    expect(asMgDl.success).toBe(true);
    expect(asMmol.success).toBe(false);
  });

  it("rejects a reading dated in the future", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const result = createGlucoseSchema.safeParse({ value: 110, measuredAt: tomorrow });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    const result = createGlucoseSchema.safeParse({ value: "126", measuredAt: nowIso() });
    expect(result.success).toBe(false);
  });
});

describe("medication validation", () => {
  it("requires a scheduled time for each daily dose, or none", () => {
    const mismatch = createMedicationSchema.safeParse({
      name: "Metformin",
      dosageText: "500 mg",
      frequency: "Twice daily",
      timesPerDay: 2,
      scheduleTimes: ["08:00"],
      startDate: nowIso(),
    });
    expect(mismatch.success).toBe(false);

    const matched = createMedicationSchema.safeParse({
      name: "Metformin",
      dosageText: "500 mg",
      frequency: "Twice daily",
      timesPerDay: 2,
      scheduleTimes: ["08:00", "20:00"],
      startDate: nowIso(),
    });
    expect(matched.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = createMedicationSchema.safeParse({
      name: "Metformin",
      dosageText: "500 mg",
      frequency: "Daily",
      timesPerDay: 1,
      startDate: new Date("2026-06-01T08:00:00Z").toISOString(),
      endDate: new Date("2026-01-01T08:00:00Z").toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("requires a timestamp when a dose is marked as taken", () => {
    const missing = createMedicationLogSchema.safeParse({
      medicationId: "abc123",
      status: "TAKEN",
    });
    expect(missing.success).toBe(false);

    const present = createMedicationLogSchema.safeParse({
      medicationId: "abc123",
      status: "TAKEN",
      takenAt: nowIso(),
    });
    expect(present.success).toBe(true);
  });

  it("does not require a timestamp for a missed dose", () => {
    const result = createMedicationLogSchema.safeParse({
      medicationId: "abc123",
      status: "MISSED",
    });
    expect(result.success).toBe(true);
  });
});

describe("insulin validation", () => {
  it("accepts a recorded dose", () => {
    const result = createInsulinLogSchema.safeParse({
      insulinName: "Insulin glargine",
      insulinType: "LONG_ACTING",
      doseUnits: 22,
      administeredAt: nowIso(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative or implausibly large dose", () => {
    for (const doseUnits of [-1, 0, 5000]) {
      const result = createInsulinLogSchema.safeParse({
        insulinName: "Insulin glargine",
        insulinType: "LONG_ACTING",
        doseUnits,
        administeredAt: nowIso(),
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("HbA1c validation", () => {
  it("accepts a value within the assay range", () => {
    const result = createHbA1cSchema.safeParse({
      valuePercent: 6.9,
      measuredAt: nowIso(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects values outside what the assay can report", () => {
    for (const valuePercent of [1, 40]) {
      const result = createHbA1cSchema.safeParse({ valuePercent, measuredAt: nowIso() });
      expect(result.success).toBe(false);
    }
  });
});

describe("reminder validation", () => {
  it("requires days to be selected for a weekly reminder", () => {
    const result = createReminderSchema.safeParse({
      type: "MEDICATION_REMINDER",
      title: "Take your medication",
      recurrence: "WEEKLY",
      timeOfDay: "08:00",
      daysOfWeek: [],
      timezone: "Europe/London",
    });
    expect(result.success).toBe(false);
  });

  it("requires a time of day for a recurring reminder", () => {
    const result = createReminderSchema.safeParse({
      type: "GLUCOSE_REMINDER",
      title: "Log a reading",
      recurrence: "DAILY",
      timezone: "Europe/London",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised time zone", () => {
    const result = createReminderSchema.safeParse({
      type: "GLUCOSE_REMINDER",
      title: "Log a reading",
      recurrence: "DAILY",
      timeOfDay: "08:00",
      timezone: "Mars/Olympus_Mons",
    });
    expect(result.success).toBe(false);
  });

  it("accepts 24-hour times and rejects malformed ones", () => {
    expect(timeOfDaySchema.safeParse("08:00").success).toBe(true);
    expect(timeOfDaySchema.safeParse("23:59").success).toBe(true);
    expect(timeOfDaySchema.safeParse("24:00").success).toBe(false);
    expect(timeOfDaySchema.safeParse("8:00").success).toBe(false);
    expect(timeOfDaySchema.safeParse("08:60").success).toBe(false);
  });
});

describe("clinical threshold validation", () => {
  const base = {
    key: "glucose.fasting.target",
    domain: "glucose",
    unit: "mg/dL",
    label: "Fasting target",
    source: "ADA Standards of Care 2024",
  };

  it("requires at least one bound", () => {
    const result = createThresholdSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects a lower bound above the upper bound", () => {
    const result = createThresholdSchema.safeParse({
      ...base,
      lowValue: 200,
      highValue: 100,
    });
    expect(result.success).toBe(false);
  });

  it("requires a source, so no threshold is unattributable", () => {
    const { source: _omitted, ...withoutSource } = base;
    const result = createThresholdSchema.safeParse({
      ...withoutSource,
      lowValue: 80,
      highValue: 130,
    });
    expect(result.success).toBe(false);
  });

  it("requires a study for a study-scoped threshold", () => {
    const result = createThresholdSchema.safeParse({
      ...base,
      scope: "STUDY",
      lowValue: 80,
      highValue: 130,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed global threshold", () => {
    const result = createThresholdSchema.safeParse({
      ...base,
      lowValue: 80,
      highValue: 130,
    });
    expect(result.success).toBe(true);
  });
});

describe("pagination and ranges", () => {
  it("applies defaults when nothing is supplied", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 25 });
  });

  it("caps the page size so a caller cannot request the whole table", () => {
    const result = paginationSchema.safeParse({ page: 1, pageSize: 100000 });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings from the query string", () => {
    const result = paginationSchema.parse({ page: "3", pageSize: "50" });
    expect(result).toEqual({ page: 3, pageSize: 50 });
  });

  it("requires both bounds for a custom range", () => {
    const result = dateRangeSchema.safeParse({ range: "custom" });
    expect(result.success).toBe(false);
  });

  it("rejects a range whose start is after its end", () => {
    const result = dateRangeSchema.safeParse({
      range: "custom",
      from: "2026-06-01",
      to: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("resolves presets to the expected span", () => {
    const { from, to } = resolveDateRange({ range: "7d" });
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(7);
  });
});

describe("export request validation", () => {
  it("rejects an unknown dataset", () => {
    const result = exportRequestSchema.safeParse({
      datasetType: "everything",
      format: "csv",
      range: "30d",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a known dataset and format", () => {
    const result = exportRequestSchema.safeParse({
      datasetType: "participant-summary",
      format: "xlsx",
      range: "90d",
    });
    expect(result.success).toBe(true);
  });
});
