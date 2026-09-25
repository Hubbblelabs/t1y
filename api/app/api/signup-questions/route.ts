import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listSignupQuestions } from "@/lib/services/profile-fields";

/**
 * GET /api/signup-questions — what the sign-up chat asks, in order.
 *
 * Public: sign-up happens before there is a session to authenticate. Only the
 * questions an admin has marked "ask at sign-up" appear, with their wording,
 * the kind of answer each takes, and what counts as a good one — the same
 * things already visible on the screen, so nothing is exposed that a person
 * signing up would not see anyway.
 *
 * The app carries its own copy of the original four as a fallback, so a
 * server that is unreachable never stops anyone signing up.
 */
export const GET = defineRoute({
  auth: "public",
  handler: async () => ok(await listSignupQuestions()),
});
