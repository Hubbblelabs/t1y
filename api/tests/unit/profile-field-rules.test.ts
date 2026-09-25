import { describe, expect, it } from "vitest";

import {
  ageInYears,
  checkAnswer,
  describeRules,
  parseRules,
  type ProfileFieldRules,
} from "@/lib/services/profile-field-rules";

/**
 * The rules here are the ones the Flutter app hardcodes today
 * (app/lib/models/signup_question.dart), so a wrong transcription shows up as
 * a failing case rather than a family being told "invalid" for a good answer.
 */

const NOW = new Date("2026-09-20T12:00:00Z");

const name = {
  labelEn: "Child's name",
  fieldType: "TEXT" as const,
  rules: { minLength: 2, maxLength: 80, format: "LETTERS" } as ProfileFieldRules,
};
const dob = {
  labelEn: "Date of birth",
  fieldType: "DATE" as const,
  rules: { notInFuture: true, minAgeYears: 0, maxAgeYears: 25 } as ProfileFieldRules,
};
const diagnosisYear = {
  labelEn: "Year of diagnosis",
  fieldType: "NUMBER" as const,
  rules: {
    min: 1900,
    wholeNumber: true,
    upToCurrentYear: true,
    notBeforeYearOf: "dateOfBirth",
  } as ProfileFieldRules,
};

describe("text rules", () => {
  it("accepts an English and a Tamil name", () => {
    expect(checkAnswer(name, "Anbu", { now: NOW })).toBeNull();
    expect(checkAnswer(name, "அன்பு", { now: NOW })).toBeNull();
    expect(checkAnswer(name, "Mary-Ann O'Neil", { now: NOW })).toBeNull();
  });

  it("refuses too short, too long, and non-letters", () => {
    expect(checkAnswer(name, "A", { now: NOW })).toMatch(/at least 2/);
    expect(checkAnswer(name, "x".repeat(81), { now: NOW })).toMatch(/under 80/);
    expect(checkAnswer(name, "Anbu123", { now: NOW })).toMatch(/letters only/);
  });

  it("refuses something that is not text", () => {
    expect(checkAnswer(name, 42, { now: NOW })).toMatch(/must be text/);
  });
});

describe("date rules", () => {
  it("accepts a plausible birth date", () => {
    expect(checkAnswer(dob, "2016-04-10", { now: NOW })).toBeNull();
  });

  it("refuses a date in the future", () => {
    expect(checkAnswer(dob, "2027-01-01", { now: NOW })).toMatch(/future/);
  });

  it("refuses someone older than the study allows", () => {
    expect(checkAnswer(dob, "1990-01-01", { now: NOW })).toMatch(/too long ago/);
  });

  it("refuses something that is not a date", () => {
    expect(checkAnswer(dob, "not-a-date", { now: NOW })).toMatch(/valid date/);
  });
});

describe("number rules", () => {
  it("accepts a sensible diagnosis year", () => {
    expect(
      checkAnswer(diagnosisYear, 2020, { now: NOW, answers: { dateOfBirth: "2016-04-10" } }),
    ).toBeNull();
  });

  it("refuses a year before 1900 or after this year", () => {
    expect(checkAnswer(diagnosisYear, 1850, { now: NOW })).toMatch(/less than 1900/);
    expect(checkAnswer(diagnosisYear, 2031, { now: NOW })).toMatch(/later than 2026/);
  });

  it("refuses a fraction where a whole number is needed", () => {
    expect(checkAnswer(diagnosisYear, 2020.5, { now: NOW })).toMatch(/whole number/);
  });

  /** The exact slip the app's own comment describes: diagnosed before being born. */
  it("refuses a diagnosis earlier than the birth year", () => {
    expect(
      checkAnswer(diagnosisYear, 2015, { now: NOW, answers: { dateOfBirth: "2018-06-01" } }),
    ).toMatch(/cannot be earlier than 2018/);
  });

  it("does not compare against a birth date that was never given", () => {
    expect(checkAnswer(diagnosisYear, 2015, { now: NOW, answers: {} })).toBeNull();
  });

  it("enforces a measurement range", () => {
    const height = {
      labelEn: "Height",
      fieldType: "NUMBER" as const,
      rules: { min: 50, max: 280 } as ProfileFieldRules,
    };
    expect(checkAnswer(height, 120, { now: NOW })).toBeNull();
    expect(checkAnswer(height, 20, { now: NOW })).toMatch(/less than 50/);
    expect(checkAnswer(height, 400, { now: NOW })).toMatch(/more than 280/);
    expect(checkAnswer(height, Number.NaN, { now: NOW })).toMatch(/must be a number/);
  });
});

describe("ageInYears", () => {
  it("does not count a birthday that has not happened yet", () => {
    expect(ageInYears(new Date("2016-10-01"), NOW)).toBe(9);
    expect(ageInYears(new Date("2016-09-20"), NOW)).toBe(10);
  });
});

describe("parseRules", () => {
  it("accepts rules that suit the type", () => {
    expect(parseRules("TEXT", { minLength: 2, maxLength: 80 })).toEqual({
      ok: true,
      rules: { minLength: 2, maxLength: 80 },
    });
  });

  it("refuses rules that belong to another type", () => {
    expect(parseRules("TEXT", { min: 1 }).ok).toBe(false);
    expect(parseRules("DATE", { maxLength: 5 }).ok).toBe(false);
  });

  it("refuses a range that contradicts itself", () => {
    expect(parseRules("NUMBER", { min: 10, max: 5 })).toMatchObject({ ok: false });
    expect(parseRules("TEXT", { minLength: 9, maxLength: 3 })).toMatchObject({ ok: false });
    expect(parseRules("DATE", { minAgeYears: 20, maxAgeYears: 5 })).toMatchObject({ ok: false });
  });

  it("stores nothing for rules that say nothing", () => {
    expect(parseRules("TEXT", { minLength: null, format: null })).toEqual({ ok: true, rules: null });
    expect(parseRules("NUMBER", null)).toEqual({ ok: true, rules: null });
  });
});

describe("describeRules", () => {
  it("reads the name rules back in words", () => {
    expect(describeRules("TEXT", name.rules)).toEqual([
      "2 to 80 characters",
      "Letters only (English or Tamil), with spaces, hyphens and apostrophes",
    ]);
  });

  it("reads a measurement range with its unit", () => {
    expect(describeRules("NUMBER", { min: 50, max: 280 }, { unit: "cm" })).toEqual([
      "Between 50 and 280 cm",
    ]);
  });

  it("names the other question a year is compared with", () => {
    const lines = describeRules("NUMBER", diagnosisYear.rules, {
      labelOf: (key) => (key === "dateOfBirth" ? "Date of birth" : key),
    });
    expect(lines).toContain('Not earlier than the year of "Date of birth"');
    expect(lines).toContain("A whole number");
    expect(lines).toContain("Not later than this year");
  });

  it("describes the birth-date window", () => {
    expect(describeRules("DATE", dob.rules)).toEqual([
      "Cannot be in the future",
      "Makes the child between 0 and 25 years old",
    ]);
  });

  it("says a choice is one of its options", () => {
    expect(describeRules("CHOICE", null)).toEqual(["One of the listed options"]);
  });
});
