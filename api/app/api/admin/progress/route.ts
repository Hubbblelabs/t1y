import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { getCohortProgress } from "@/lib/services/progress";

/**
 * Cohort-level adherence: topic open/completion counts and quiz pass rates.
 * This is the study's real-time engagement proxy — distinct from the
 * clinical PedsQL/WE-CARE outcomes, which are collected outside the app.
 */
export const GET = defineRoute({
  capability: Capability.RESEARCH_VIEW,
  handler: async () => ok(await getCohortProgress()),
});
