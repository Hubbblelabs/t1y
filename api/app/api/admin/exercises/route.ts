import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  createProgram,
  getProgramStats,
  listProgramsForAdmin,
} from "@/lib/services/exercise-content";
import { toSkipTake } from "@/lib/validation/common";
import { createProgramSchema, programListQuerySchema } from "@/lib/validation/admin";

/** Guided exercise programmes. */

export const GET = defineRoute({
  capability: Capability.EXERCISE_CONTENT_MANAGE,
  query: programListQuerySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, stats] = await Promise.all([
      listProgramsForAdmin({
        status: query.status,
        category: query.category,
        difficulty: query.difficulty,
        search: query.search,
        skip,
        take,
      }),
      getProgramStats(),
    ]);

    return paginated(items, buildPagination(query.page, query.pageSize, total), { stats });
  },
});

export const POST = defineRoute({
  capability: Capability.EXERCISE_CONTENT_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createProgramSchema,
  handler: async ({ principal, body, audit }) => {
    const program = await createProgram(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EXERCISE_CONTENT_CREATED,
        resourceType: "exercise-content",
        resourceId: program.id,
        description: `Created programme "${program.title}"`,
        metadata: { status: program.status, difficulty: program.difficulty },
      },
      audit,
    );

    return created(program);
  },
});
