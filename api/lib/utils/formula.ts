/**
 * A small, closed arithmetic language for admin-defined calculators.
 *
 * ## Why this exists rather than `eval`
 *
 * Calculators in this product turn parent-entered numbers into insulin
 * guidance. The formulas are written by study staff through the dashboard,
 * stored in the database, and evaluated on a child's phone. That makes a
 * stored formula an input crossing a trust boundary twice over, so it is
 * parsed by an explicit grammar that can express arithmetic and nothing else.
 * `eval`, `new Function`, and every "tiny expression library" that compiles to
 * them are out of the question: a formula field that can reach `fetch` or
 * `localStorage` is a stored-XSS hole wearing a lab coat.
 *
 * ## The language
 *
 *   number        12, 3.5, .5
 *   variable      tdd, carbs, glucose  (letters, digits, underscore; not
 *                                       leading-digit)
 *   operators     + - * / ( ) and unary minus
 *   functions     min(a, b), max(a, b), round(x), floor(x), ceil(x)
 *
 * No assignment, no comparison, no strings, no property access, no calls to
 * anything not in the table above. An unknown identifier is a parse error, not
 * an implicit `undefined` — a typo in a dosing formula must fail loudly at the
 * moment it is written, not produce NaN on a phone months later.
 *
 * ## Dart counterpart
 *
 * app/lib/services/formula.dart implements the same grammar so the app can
 * evaluate offline. The two must stay in step; both are covered by tests
 * asserting identical results for the same expressions.
 */

export class FormulaError extends Error {}

type TokenType = "number" | "identifier" | "operator" | "paren" | "comma";

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/** Functions a formula may call, with their exact arity. */
const FUNCTIONS: Record<string, { arity: number; apply: (args: number[]) => number }> = {
  min: { arity: 2, apply: ([a, b]) => Math.min(a, b) },
  max: { arity: 2, apply: ([a, b]) => Math.max(a, b) },
  round: { arity: 1, apply: ([a]) => Math.round(a) },
  floor: { arity: 1, apply: ([a]) => Math.floor(a) },
  ceil: { arity: 1, apply: ([a]) => Math.ceil(a) },
};

export const FORMULA_FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** Longest expression accepted, as a guard against pathological input. */
const MAX_LENGTH = 500;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const start = i;
      while (i < source.length && /[0-9.]/.test(source[i])) i += 1;
      const value = source.slice(start, i);
      // "1.2.3" tokenizes as one run of digits-and-dots; reject it here
      // rather than letting Number() quietly return NaN.
      if ((value.match(/\./g) ?? []).length > 1 || value === ".") {
        throw new FormulaError(`"${value}" is not a number.`);
      }
      tokens.push({ type: "number", value, position: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1;
      tokens.push({ type: "identifier", value: source.slice(start, i), position: start });
      continue;
    }

    if ("+-*/".includes(char)) {
      tokens.push({ type: "operator", value: char, position: i });
      i += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char, position: i });
      i += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char, position: i });
      i += 1;
      continue;
    }

    throw new FormulaError(`"${char}" cannot be used in a formula.`);
  }

  return tokens;
}

/**
 * Recursive-descent parser producing a value directly.
 *
 * Grammar, lowest precedence first:
 *   expression := term (("+" | "-") term)*
 *   term       := factor (("*" | "/") factor)*
 *   factor     := ("-")? primary
 *   primary    := number | identifier | call | "(" expression ")"
 */
class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: Readonly<Record<string, number>>,
    /** When set, identifiers are checked but arithmetic is not performed. */
    private readonly declaredOnly: ReadonlySet<string> | null,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private next(): Token | undefined {
    return this.tokens[this.index++];
  }

  parse(): number {
    const value = this.expression();
    const leftover = this.peek();
    if (leftover) {
      throw new FormulaError(`Unexpected "${leftover.value}" in the formula.`);
    }
    return value;
  }

  private expression(): number {
    let value = this.term();
    for (;;) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) break;
      this.next();
      const right = this.term();
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    for (;;) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/")) break;
      this.next();
      const right = this.factor();
      if (token.value === "*") {
        value *= right;
      } else {
        // Dividing by zero is the single most likely way an admin-authored
        // dosing formula goes wrong (a total daily dose of 0 is a perfectly
        // ordinary thing for a parent to type). Refusing here means the app
        // shows "check your numbers", never "Infinity units".
        if (right === 0) throw new FormulaError("This works out as a division by zero.");
        value /= right;
      }
    }
    return value;
  }

  private factor(): number {
    const token = this.peek();
    if (token?.type === "operator" && token.value === "-") {
      this.next();
      return -this.factor();
    }
    if (token?.type === "operator" && token.value === "+") {
      this.next();
      return this.factor();
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.next();
    if (!token) throw new FormulaError("The formula ends too early.");

    if (token.type === "number") return Number(token.value);

    if (token.type === "identifier") {
      const fn = FUNCTIONS[token.value];
      if (fn) return this.call(token.value, fn);

      if (this.declaredOnly) {
        if (!this.declaredOnly.has(token.value)) {
          throw new FormulaError(`"${token.value}" is not one of this calculator's inputs.`);
        }
        // Checking only: a stand-in that exercises every branch without
        // pretending to be a real measurement.
        return 1;
      }

      const value = this.variables[token.value];
      if (value === undefined) {
        throw new FormulaError(`No value was given for "${token.value}".`);
      }
      if (!Number.isFinite(value)) {
        throw new FormulaError(`The value for "${token.value}" is not a number.`);
      }
      return value;
    }

    if (token.type === "paren" && token.value === "(") {
      const value = this.expression();
      const closing = this.next();
      if (closing?.value !== ")") throw new FormulaError("A bracket is not closed.");
      return value;
    }

    throw new FormulaError(`Unexpected "${token.value}" in the formula.`);
  }

  private call(name: string, fn: (typeof FUNCTIONS)[string]): number {
    const open = this.next();
    if (open?.value !== "(") throw new FormulaError(`"${name}" must be followed by a bracket.`);

    const args: number[] = [];
    if (this.peek()?.value === ")") {
      this.next();
    } else {
      for (;;) {
        args.push(this.expression());
        const separator = this.next();
        if (separator?.value === ")") break;
        if (separator?.value !== ",") throw new FormulaError(`"${name}" is missing a bracket.`);
      }
    }

    if (args.length !== fn.arity) {
      throw new FormulaError(
        `"${name}" needs ${fn.arity} number${fn.arity === 1 ? "" : "s"}, not ${args.length}.`,
      );
    }
    return fn.apply(args);
  }
}

/**
 * Computes a formula against a set of named values.
 *
 * Throws {@link FormulaError} with a message written for the person who typed
 * the formula, not for a developer — these surface directly in the dashboard.
 */
export function evaluateFormula(
  expression: string,
  variables: Readonly<Record<string, number>>,
): number {
  if (expression.length > MAX_LENGTH) {
    throw new FormulaError(`A formula cannot be longer than ${MAX_LENGTH} characters.`);
  }

  const result = new Parser(tokenize(expression), variables, null).parse();

  if (!Number.isFinite(result)) {
    throw new FormulaError("This formula does not work out to a usable number.");
  }
  return result;
}

/**
 * Checks a formula at authoring time.
 *
 * Confirms it parses and that every name in it is one of the calculator's own
 * inputs (or an earlier output). Returns the error message to show, or null
 * when the formula is sound.
 */
export function validateFormula(expression: string, availableNames: readonly string[]): string | null {
  if (!expression.trim()) return "Enter a formula.";
  if (expression.length > MAX_LENGTH) {
    return `A formula cannot be longer than ${MAX_LENGTH} characters.`;
  }

  try {
    new Parser(tokenize(expression), {}, new Set(availableNames)).parse();
    return null;
  } catch (error) {
    if (error instanceof FormulaError) {
      // A division by zero found while checking is an artefact of the
      // stand-in values, not a fault in the formula — a real division by
      // zero is caught when it actually happens.
      if (error.message.includes("division by zero")) return null;
      return error.message;
    }
    throw error;
  }
}
