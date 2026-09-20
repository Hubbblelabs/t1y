/**
 * Turning a stored formula back into something readable.
 *
 * A formula is stored in terms of short names — `500 / tdd` — because that is
 * what the evaluator understands. Nobody running this study thinks in those
 * names, so anywhere a formula is shown to a person it is rendered with the
 * labels they chose instead: "500 ÷ Total daily insulin dose".
 *
 * Purely cosmetic. The stored expression is never rewritten from this; it is
 * the thing that runs, and it stays exactly as it was written.
 */

/** Names the grammar reserves, which are never a value to substitute. */
const FUNCTION_NAMES = new Set(["min", "max", "round", "floor", "ceil"]);

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * Replaces every short name in `expression` with its human label, and the
 * arithmetic symbols with the ones people actually read.
 */
export function humaniseExpression(
  expression: string,
  labels: Readonly<Record<string, string>>,
): string {
  return expression
    .replace(IDENTIFIER, (name) =>
      FUNCTION_NAMES.has(name) ? name : (labels[name] ?? name),
    )
    .replace(/\*/g, " × ")
    .replace(/\//g, " ÷ ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every value name a formula refers to, in the order it first mentions them.
 *
 * Used to derive a calculator's inputs from its formulas rather than keeping
 * a second list by hand — two lists that must agree are two lists that will
 * eventually disagree.
 */
export function namesUsedIn(expressions: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const expression of expressions) {
    for (const match of expression.matchAll(IDENTIFIER)) {
      const name = match[0];
      if (FUNCTION_NAMES.has(name) || seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
  }

  return ordered;
}
