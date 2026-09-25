import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listProgressForUser } from "@/lib/services/progress";

/** The caller's own topic and quiz progress — read-only; writes only via /api/sync. */
export const GET = defineRoute({
  handler: async ({ principal }) => ok(await listProgressForUser(principal.userId)),
});
