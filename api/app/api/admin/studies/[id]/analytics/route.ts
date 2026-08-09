import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertCanViewStudy } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getStudyAnalytics } from "@/lib/services/research";
import { dateRangeSchema, idParamSchema, resolveDateRange } from "@/lib/validation/common";

/**
 * Cohort analytics for a single study: enrolment progress, data completeness,
 * measurement frequency and adherence.
 */
export const GET = defineRoute({
  capability: Capability.RESEARCH_VIEW,
  params: idParamSchema,
  query: dateRangeSchema,
  handler: async ({ principal, params, query }) => {
    await assertCanViewStudy(principal, params.id);

    const { from, to } = resolveDateRange(query);
    const analytics = await getStudyAnalytics({ studyId: params.id, from, to });

    return ok(analytics, {
      meta: { range: { from: from.toISOString(), to: to.toISOString() } },
    });
  },
});
