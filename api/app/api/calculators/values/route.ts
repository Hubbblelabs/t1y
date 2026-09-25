import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { resolveCatalogueValues } from "@/lib/services/health-data-catalogue";
import { z } from "zod";

const querySchema = z.object({
  /** Comma-separated catalogue keys the calculator screen needs filling in. */
  keys: z
    .string()
    .trim()
    .min(1)
    .transform((raw) => raw.split(",").map((key) => key.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(60)).max(30)),
});

/**
 * GET /api/calculators/values?keys=glucose_latest,insulin_total_daily_dose
 *
 * The signed-in child's own values for the given catalogue keys, used to
 * pre-fill a calculator.
 *
 * Always scoped to the caller — the principal's own id is used, never an id
 * from the request — so this cannot be turned into a way to read another
 * child's readings.
 *
 * Each value carries `recordedAt`, which the app shows beside the filled-in
 * number, and a missing one comes back as null with a reason rather than as
 * zero: a glucose reading that does not exist must never be calculated with
 * as though it were 0 mg/dL.
 */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ principal, query }) =>
    ok(await resolveCatalogueValues(principal.userId, query.keys)),
});
