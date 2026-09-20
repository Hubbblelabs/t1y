import { describe, expect, it } from "vitest";

import { FormulaError, evaluateFormula, validateFormula } from "@/lib/utils/formula";

describe("evaluateFormula", () => {
  it("applies normal operator precedence", () => {
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
  });

  it("handles unary minus, including doubled", () => {
    expect(evaluateFormula("-5 + 2", {})).toBe(-3);
    expect(evaluateFormula("--5", {})).toBe(5);
    expect(evaluateFormula("3 * -2", {})).toBe(-6);
  });

  it("substitutes named values", () => {
    expect(evaluateFormula("tdd * 2", { tdd: 21 })).toBe(42);
  });

  it("supports the permitted functions", () => {
    expect(evaluateFormula("min(4, 9)", {})).toBe(4);
    expect(evaluateFormula("max(4, 9)", {})).toBe(9);
    expect(evaluateFormula("round(2.5)", {})).toBe(3);
    expect(evaluateFormula("floor(2.9)", {})).toBe(2);
    expect(evaluateFormula("ceil(2.1)", {})).toBe(3);
  });

  it("nests function calls and expressions", () => {
    expect(evaluateFormula("max(round(1.4), min(2, 3))", {})).toBe(2);
  });

  /**
   * The formulas this feature exists to express, from the curriculum's
   * Nutrition and Insulin Basics material (the 1980 Davidson rules). If these
   * ever stop matching what the app's own calculator computes, one of the two
   * has drifted.
   */
  describe("the curriculum's own formulas", () => {
    it("computes the insulin-to-carb ratio as 500 / total daily dose", () => {
      expect(evaluateFormula("500 / tdd", { tdd: 20 })).toBe(25);
    });

    it("computes the correction factor with the 1800 rule for rapid-acting", () => {
      expect(evaluateFormula("1800 / tdd", { tdd: 30 })).toBe(60);
    });

    it("computes the correction factor with the 1500 rule for short-acting", () => {
      expect(evaluateFormula("1500 / tdd", { tdd: 30 })).toBe(50);
    });

    it("computes a meal dose as carbs divided by the ratio", () => {
      expect(evaluateFormula("carbs / icRatio", { carbs: 60, icRatio: 15 })).toBe(4);
    });
  });

  describe("refusals", () => {
    it("refuses division by zero rather than returning Infinity", () => {
      expect(() => evaluateFormula("500 / tdd", { tdd: 0 })).toThrow(FormulaError);
      expect(() => evaluateFormula("500 / tdd", { tdd: 0 })).toThrow(/division by zero/);
    });

    it("refuses an unknown name instead of treating it as zero", () => {
      expect(() => evaluateFormula("dose * 2", {})).toThrow(/No value was given for "dose"/);
    });

    it("refuses a non-numeric value", () => {
      expect(() => evaluateFormula("x + 1", { x: Number.NaN })).toThrow(/not a number/);
    });

    it("refuses unbalanced brackets", () => {
      expect(() => evaluateFormula("(1 + 2", {})).toThrow(FormulaError);
      expect(() => evaluateFormula("1 + 2)", {})).toThrow(FormulaError);
    });

    it("refuses a malformed number", () => {
      expect(() => evaluateFormula("1.2.3", {})).toThrow(FormulaError);
    });

    it("refuses a function called with the wrong number of arguments", () => {
      expect(() => evaluateFormula("min(1)", {})).toThrow(/needs 2 numbers/);
      expect(() => evaluateFormula("round(1, 2)", {})).toThrow(/needs 1 number/);
    });

    it("refuses an empty formula", () => {
      expect(() => evaluateFormula("", {})).toThrow(FormulaError);
    });

    /**
     * The whole reason this is a parser and not `eval`. Each of these is
     * valid JavaScript that must not be valid here.
     */
    it("refuses anything that is not arithmetic", () => {
      const attacks = [
        "fetch('http://example.com')",
        "globalThis.process",
        "this.constructor",
        "[].constructor",
        "x = 1",
        "1 && 2",
        "a ? b : c",
        "`x`",
        "x.y",
        "x['y']",
        "function(){}",
        "() => 1",
        "1; 2",
      ];
      for (const attack of attacks) {
        expect(() => evaluateFormula(attack, { x: 1, a: 1, b: 2, c: 3 })).toThrow();
      }
    });

    it("refuses an over-long formula", () => {
      expect(() => evaluateFormula("1+".repeat(400) + "1", {})).toThrow(/longer than/);
    });
  });
});

describe("validateFormula", () => {
  it("accepts a formula using only declared inputs", () => {
    expect(validateFormula("500 / tdd", ["tdd"])).toBeNull();
  });

  it("names the input that does not exist", () => {
    expect(validateFormula("500 / ttd", ["tdd"])).toMatch(/"ttd" is not one of this calculator's inputs/);
  });

  it("accepts permitted functions without declaring them as inputs", () => {
    expect(validateFormula("round(500 / tdd)", ["tdd"])).toBeNull();
  });

  it("reports a syntax error in plain language", () => {
    expect(validateFormula("500 /", ["tdd"])).toMatch(/ends too early/);
  });

  it("rejects an empty formula", () => {
    expect(validateFormula("   ", ["tdd"])).toBe("Enter a formula.");
  });

  /**
   * Checking uses stand-in values, so a formula that divides by an input
   * must not be reported as broken merely because the stand-in happened to
   * make the denominator zero.
   */
  it("does not report a division by zero found with stand-in values", () => {
    expect(validateFormula("500 / (tdd - tdd)", ["tdd"])).toBeNull();
  });
});
