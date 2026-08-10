import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/api/errors";
import { toCsv, type ExportDataset } from "@/lib/services/exports";
import { assertNoHealthValues, computeNextTrigger } from "@/lib/services/notifications";
import { classify } from "@/lib/services/thresholds";
import { __testing as loggerTesting } from "@/lib/utils/logger";
import { sanitizeRichText, slugify, toPlainText } from "@/lib/utils/sanitize";

/**
 * Safety properties.
 *
 * These are the behaviours that protect participants rather than the ones that
 * make features work: nothing sensitive reaches a log, a spreadsheet cell
 * cannot become a formula, authored HTML cannot carry script, a lock-screen
 * preview cannot leak a measurement, and the platform never states a clinical
 * judgement it was not configured to make.
 */

function dataset(
  columns: string[],
  rows: Array<Array<string | number | null>>,
): ExportDataset {
  return { name: "test", columns, rows, truncated: false, generatedAt: new Date() };
}

describe("log scrubbing", () => {
  const { scrub } = loggerTesting;

  it("redacts credentials and tokens", () => {
    const output = scrub({
      password: "hunter2",
      accessToken: "abc.def.ghi",
      authorization: "Bearer xyz",
      apiKey: "sk-live-1234",
      cookie: "session=1",
    });

    for (const value of Object.values(output)) {
      expect(value).toBe("[redacted]");
    }
    expect(JSON.stringify(output)).not.toContain("hunter2");
  });

  it("replaces health measurements with a marker rather than the value", () => {
    const output = scrub({ value: 342, hba1c: 11.4, notes: "felt unwell" });

    expect(output.value).toBe("[health-data]");
    expect(output.hba1c).toBe("[health-data]");
    expect(output.notes).toBe("[health-data]");
    expect(JSON.stringify(output)).not.toContain("342");
    expect(JSON.stringify(output)).not.toContain("felt unwell");
  });

  it("keeps operational identifiers that carry no personal information", () => {
    const output = scrub({ requestId: "req-1", userId: "usr-1", durationMs: 12 });

    expect(output.requestId).toBe("req-1");
    expect(output.userId).toBe("usr-1");
    expect(output.durationMs).toBe(12);
  });

  it("scrubs nested objects", () => {
    const output = scrub({ context: { password: "x", requestId: "r" } });
    expect(output.context).toEqual({ password: "[redacted]", requestId: "r" });
  });

  it("summarises arrays instead of emitting their contents", () => {
    expect(scrub({ ids: ["a", "b"] }).ids).toBe("[array(2)]");
  });

  it("stops recursing on deeply nested input", () => {
    const deep = { a: { b: { c: { d: { e: "leaf" } } } } };
    expect(() => scrub(deep)).not.toThrow();
    expect(JSON.stringify(scrub(deep))).toContain("truncated");
  });
});

describe("rich text sanitisation", () => {
  it("strips script tags", () => {
    const output = sanitizeRichText('<p>Safe</p><script>alert("xss")</script>');
    expect(output).toContain("Safe");
    expect(output).not.toContain("script");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeRichText('<p onclick="steal()">Text</p>')).not.toContain("onclick");
  });

  it("removes javascript: URLs", () => {
    const output = sanitizeRichText('<a href="javascript:alert(1)">Link</a>');
    expect(output).not.toContain("javascript:");
  });

  it("removes data: image sources", () => {
    const output = sanitizeRichText('<img src="data:text/html;base64,PHNjcmlwdD4=" />');
    expect(output).not.toContain("data:");
  });

  it("keeps the formatting an author legitimately needs", () => {
    const output = sanitizeRichText(
      '<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul><a href="https://example.org">Link</a>',
    );
    expect(output).toContain("<h2>");
    expect(output).toContain("<strong>");
    expect(output).toContain("<li>");
    expect(output).toContain('href="https://example.org"');
  });

  it("adds noopener to links that open a new tab", () => {
    const output = sanitizeRichText('<a href="https://example.org" target="_blank">L</a>');
    expect(output).toContain("noopener");
  });

  it("reduces markup to plain text for exports", () => {
    expect(toPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("produces URL-safe slugs", () => {
    expect(slugify("Understanding Your HbA1c — Part 2!")).toBe(
      "understanding-your-hba1c-part-2",
    );
  });
});

describe("CSV export escaping", () => {
  it("quotes fields containing separators, quotes and newlines", () => {
    const csv = toCsv(dataset(["A", "B"], [['has "quotes"', "has, comma"]]));

    expect(csv).toContain('"has ""quotes"""');
    expect(csv).toContain('"has, comma"');
  });

  it("neutralises spreadsheet formula injection", () => {
    const csv = toCsv(
      dataset(["Value"], [["=1+1"], ["+SUM(A1)"], ["-2+3"], ["@import"], ["\tTAB"]]),
    );

    // Every dangerous leading character is prefixed with an apostrophe, so the
    // cell is imported as text rather than evaluated as a formula.
    const rows = csv.trimEnd().split("\r\n").slice(1);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.startsWith("'")).toBe(true);
    }
  });

  it("writes empty strings for null", () => {
    const csv = toCsv(dataset(["A", "B"], [[null, null]]));
    expect(csv.split("\r\n")[1]).toBe(",");
  });

  it("terminates rows with CRLF, as RFC 4180 requires", () => {
    const csv = toCsv(dataset(["A"], [["x"]]));
    expect(csv).toBe("A\r\nx\r\n");
  });
});

describe("clinical threshold classification", () => {
  const target = { lowValue: 80, highValue: 130 };

  it("returns 'unclassified' when no threshold is configured", () => {
    // The platform must present the number without judgement rather than
    // falling back to an invented default range.
    expect(classify(250, null)).toBe("unclassified");
    expect(classify(250, undefined)).toBe("unclassified");
  });

  it("returns 'unclassified' when a threshold has no bounds", () => {
    expect(classify(250, { lowValue: null, highValue: null })).toBe("unclassified");
  });

  it("returns 'unclassified' for an absent value", () => {
    expect(classify(null, target)).toBe("unclassified");
    expect(classify(undefined, target)).toBe("unclassified");
  });

  it("classifies against the configured bounds", () => {
    expect(classify(60, target)).toBe("below");
    expect(classify(100, target)).toBe("within");
    expect(classify(250, target)).toBe("above");
  });

  it("treats the bounds themselves as within range", () => {
    expect(classify(80, target)).toBe("within");
    expect(classify(130, target)).toBe("within");
  });

  it("supports one-sided thresholds", () => {
    expect(classify(50, { lowValue: null, highValue: 130 })).toBe("within");
    expect(classify(200, { lowValue: null, highValue: 130 })).toBe("above");
    expect(classify(50, { lowValue: 80, highValue: null })).toBe("below");
    expect(classify(200, { lowValue: 80, highValue: null })).toBe("within");
  });
});

describe("notification content safety", () => {
  it("rejects copy containing a measurement with units", () => {
    const offenders = [
      "Your glucose was 243 mg/dL this morning",
      "Latest HbA1c: 9.8%",
      "You took 22 units last night",
      "Your weight is 88 kg",
      "Blood pressure 140 mmHg",
    ];

    for (const text of offenders) {
      expect(() => assertNoHealthValues(text)).toThrow(ValidationError);
    }
  });

  it("accepts generic prompts that disclose nothing", () => {
    const safe = [
      "Time to log your reading",
      "A new article is available",
      "Remember to take your medication",
      null,
      undefined,
    ];

    expect(() => assertNoHealthValues(...safe)).not.toThrow();
  });

  it("checks every supplied string, not only the first", () => {
    expect(() =>
      assertNoHealthValues("Time to log your reading", "Last value 243 mg/dL"),
    ).toThrow(ValidationError);
  });
});

describe("reminder scheduling", () => {
  const from = new Date("2026-03-02T00:00:00Z"); // A Monday.

  it("returns null for a non-recurring reminder", () => {
    const next = computeNextTrigger(
      { recurrence: "NONE", timeOfDay: "08:00", daysOfWeek: [], timezone: "UTC" },
      from,
    );
    expect(next).toBeNull();
  });

  it("returns null when no time of day is set", () => {
    const next = computeNextTrigger(
      { recurrence: "DAILY", timeOfDay: null, daysOfWeek: [], timezone: "UTC" },
      from,
    );
    expect(next).toBeNull();
  });

  it("schedules the next daily occurrence in the participant's time zone", () => {
    const next = computeNextTrigger(
      { recurrence: "DAILY", timeOfDay: "08:00", daysOfWeek: [], timezone: "UTC" },
      from,
    );
    expect(next?.toISOString()).toBe("2026-03-02T08:00:00.000Z");
  });

  it("rolls to the next day once today's time has passed", () => {
    const next = computeNextTrigger(
      { recurrence: "DAILY", timeOfDay: "08:00", daysOfWeek: [], timezone: "UTC" },
      new Date("2026-03-02T09:00:00Z"),
    );
    expect(next?.toISOString()).toBe("2026-03-03T08:00:00.000Z");
  });

  it("honours a non-UTC time zone", () => {
    // 08:00 in New York on 2 March 2026 is 13:00 UTC (EST, UTC-5).
    const next = computeNextTrigger(
      { recurrence: "DAILY", timeOfDay: "08:00", daysOfWeek: [], timezone: "America/New_York" },
      from,
    );
    expect(next?.toISOString()).toBe("2026-03-02T13:00:00.000Z");
  });

  it("picks the next selected weekday for a weekly reminder", () => {
    // Wednesday (ISO 3), starting from Monday.
    const next = computeNextTrigger(
      { recurrence: "WEEKLY", timeOfDay: "09:00", daysOfWeek: [3], timezone: "UTC" },
      from,
    );
    expect(next?.toISOString()).toBe("2026-03-04T09:00:00.000Z");
  });

  it("picks the next matching day of the month", () => {
    const next = computeNextTrigger(
      {
        recurrence: "MONTHLY",
        timeOfDay: "07:30",
        daysOfWeek: [],
        dayOfMonth: 15,
        timezone: "UTC",
      },
      from,
    );
    expect(next?.toISOString()).toBe("2026-03-15T07:30:00.000Z");
  });

  it("stops scheduling once the reminder has ended", () => {
    const next = computeNextTrigger(
      {
        recurrence: "DAILY",
        timeOfDay: "08:00",
        daysOfWeek: [],
        timezone: "UTC",
        endsAt: new Date("2026-03-01T00:00:00Z"),
      },
      from,
    );
    expect(next).toBeNull();
  });
});
