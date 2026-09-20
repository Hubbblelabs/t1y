import { describe, expect, it } from "vitest";

import { humaniseExpression, namesUsedIn } from "@/lib/utils/expression-display";

describe("humaniseExpression", () => {
  const labels = {
    tdd: "Total daily insulin dose",
    carbs: "Carbohydrates in this meal",
  };

  it("shows a formula in the words the admin chose", () => {
    expect(humaniseExpression("500 / tdd", labels)).toBe("500 ÷ Total daily insulin dose");
  });

  it("uses symbols people actually read", () => {
    expect(humaniseExpression("carbs * 2", labels)).toBe("Carbohydrates in this meal × 2");
  });

  it("leaves function names alone", () => {
    expect(humaniseExpression("round(500 / tdd)", labels)).toBe(
      "round(500 ÷ Total daily insulin dose)",
    );
  });

  it("leaves a name it has no label for as it is", () => {
    expect(humaniseExpression("500 / mystery", labels)).toBe("500 ÷ mystery");
  });
});

describe("namesUsedIn", () => {
  it("lists the values a formula refers to, in order of first mention", () => {
    expect(namesUsedIn(["carbs / icRatio", "icRatio * tdd"])).toEqual([
      "carbs",
      "icRatio",
      "tdd",
    ]);
  });

  it("does not mistake a function for a value", () => {
    expect(namesUsedIn(["round(min(a, b))"])).toEqual(["a", "b"]);
  });

  it("ignores numbers", () => {
    expect(namesUsedIn(["500 / 20"])).toEqual([]);
  });
});
