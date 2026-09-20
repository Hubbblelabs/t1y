import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createCalculator, listCalculatorsForAdmin } from "@/lib/services/calculators";
import { createCalculatorSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  handler: async () => ok(await listCalculatorsForAdmin()),
});

/**
 * POST /api/admin/calculators
 *
 * The only way a formula ever enters the system — calculators cannot be
 * edited afterwards (see lib/services/calculators.ts). Every formula is
 * parsed and checked against the calculator's own inputs before anything is
 * stored, and the whole definition is recorded in the audit entry so the
 * exact arithmetic a family was shown can be reconstructed later.
 */
export const POST = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createCalculatorSchema,
  handler: async ({ principal, body, audit }) => {
    const calculator = await createCalculator(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.CALCULATOR_CREATED,
        resourceType: "calculator",
        resourceId: calculator.id,
        description: `Created calculator "${calculator.nameEn}"`,
        metadata: {
          key: calculator.key,
          inputs: body.inputs.map((input) => input.key),
          // The formulas themselves, verbatim: this is clinical arithmetic
          // reaching a caregiver, and "what did it compute in March" has to
          // be answerable from the audit trail alone.
          outputs: body.outputs.map((output) => ({
            key: output.key,
            expression: output.expression,
          })),
          supersedes: body.supersedesId ?? null,
        },
      },
      audit,
    );

    return created(calculator);
  },
});
