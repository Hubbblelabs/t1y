import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { runCalculator } from "@/lib/services/calculators";
import { calculatorPreviewSchema } from "@/lib/validation/admin";

/**
 * POST /api/admin/calculators/preview
 *
 * Runs an unsaved calculator against sample numbers so the author can see
 * what it produces before committing to it. Writes nothing.
 *
 * This matters more here than a preview usually does: a calculator cannot be
 * corrected after it is created, so trying it out is the only chance to catch
 * a formula that parses cleanly but computes the wrong thing. It deliberately
 * shares `runCalculator` with every other caller, so what the author sees is
 * produced by the code that will run for real.
 */
export const POST = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: calculatorPreviewSchema,
  handler: async ({ body }) => {
    const { results, error } = runCalculator(
      { inputs: body.inputs, outputs: body.outputs },
      body.values,
    );

    return ok({ results, error });
  },
});
