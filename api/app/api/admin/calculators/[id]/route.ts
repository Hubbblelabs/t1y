import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { getCalculatorById, setCalculatorActive } from "@/lib/services/calculators";
import { calculatorVisibilitySchema } from "@/lib/validation/admin";
import { idParamSchema } from "@/lib/validation/common";

export const GET = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getCalculatorById(params.id)),
});

/**
 * PATCH /api/admin/calculators/[id]
 *
 * Shows or hides a calculator. That is the *only* change a stored calculator
 * accepts: its formulas are fixed at creation, so this route takes nothing
 * but `active`. There is no PUT and no DELETE — a calculator families have
 * used stays on the record even after it is withdrawn.
 */
export const PATCH = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: calculatorVisibilitySchema,
  handler: async ({ principal, params, body, audit }) => {
    const calculator = await setCalculatorActive(params.id, body.active);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: body.active ? AuditAction.CALCULATOR_SHOWN : AuditAction.CALCULATOR_HIDDEN,
        resourceType: "calculator",
        resourceId: calculator.id,
        description: `${body.active ? "Showed" : "Hid"} calculator "${calculator.nameEn}"`,
        metadata: { key: calculator.key },
      },
      audit,
    );

    return ok(calculator);
  },
});
