import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getBadgeCollection } from "@/lib/services/badges";

/**
 * GET /api/badges — everything the trophy screen renders: the child's badge
 * per quiz, the totals by tier, how many published quizzes are still
 * unbadged, how many they've attempted, and their average best score.
 */

export const GET = defineRoute({
  handler: async ({ principal }) => ok(await getBadgeCollection(principal.userId)),
});
