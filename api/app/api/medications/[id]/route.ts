import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { assertOwnsRecord } from "@/lib/permissions/policies";
import {
  discontinueMedication,
  getMedication,
  updateMedication,
} from "@/lib/services/medications";
import { idParamSchema } from "@/lib/validation/common";
import { updateMedicationSchema } from "@/lib/validation/health";

export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const medication = await getMedication(params.id);
    assertOwnsRecord(principal, medication.userId);

    const { userId: _ownerId, ...rest } = medication;
    return ok(rest);
  },
});

export const PATCH = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: updateMedicationSchema,
  handler: async ({ principal, params, body }) => {
    const medication = await getMedication(params.id);
    assertOwnsRecord(principal, medication.userId);

    return ok(await updateMedication(params.id, body));
  },
});

/**
 * Discontinues rather than deletes: the medication's dose history is part of
 * the adherence record and must remain intact.
 */
export const DELETE = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const medication = await getMedication(params.id);
    assertOwnsRecord(principal, medication.userId);

    return ok(await discontinueMedication(params.id, new Date()));
  },
});
