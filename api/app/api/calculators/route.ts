import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listActiveCalculators } from "@/lib/services/calculators";

/**
 * GET /api/calculators — the calculators currently shown in the app, with
 * the numbers to ask for and the formulas that turn them into results.
 *
 * The formulas are sent to the client rather than computed here so the app
 * works without a connection: a parent working out a mealtime dose in a
 * kitchen with no signal is the normal case, not an edge case. The app
 * evaluates them with the same closed arithmetic grammar the server uses to
 * validate them (app/lib/services/formula.dart ↔ lib/utils/formula.ts), so a
 * formula that was accepted here cannot mean something different there.
 *
 * A hidden calculator simply stops appearing in this list.
 */
export const GET = defineRoute({
  handler: async () => ok(await listActiveCalculators()),
});
