import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { runCalculatorForParticipant } from "@/lib/services/calculator-run";
import { idSchema } from "@/lib/validation/common";

const paramsSchema = z.object({ id: idSchema });

const bodySchema = z.object({
  userId: idSchema,
  /** Work out values as of this moment instead of now. */
  asOf: z.coerce.date().optional(),
  /** Typed numbers that stand in for any input, "DATA"-sourced or not. */
  overrides: z.record(z.string().max(60), z.number().finite()).default({}),
});

/**
 * POST /api/admin/calculators/:id/run
 *
 * Runs a calculator for one participant. Calculators are not shown to
 * parents; this — the admin's workbench — is the only place any calculator
 * is ever run. Nothing is written to the participant's record.
 */
export const POST = defineRoute({
  capability: Capability.CALCULATORS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: paramsSchema,
  body: bodySchema,
  handler: async ({ principal, params, body, audit }) => {
    const result = await runCalculatorForParticipant({
      calculatorId: params.id,
      userId: body.userId,
      asOf: body.asOf,
      overrides: body.overrides,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.CALCULATOR_RUN,
        resourceType: "calculator",
        resourceId: params.id,
        participantId: body.userId,
        description: `Ran ${result.calculator.nameEn} for a participant`,
        metadata: { asOf: body.asOf?.toISOString() ?? null, hadError: result.error !== null },
      },
      audit,
    );

    return ok(result);
  },
});
