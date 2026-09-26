import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";

const querySchema = z.object({ search: z.string().trim().max(120).optional() });

/**
 * GET /api/admin/reports/participants?search=
 *
 * The picker on the Reports page that switches it into one child's own
 * numbers (see ReportParticipantPicker) — same shape as the calculator run
 * page's participant search, but gated on REPORTS_VIEW rather than
 * CALCULATORS_MANAGE, since a reports viewer may not be able to run one.
 */
export const GET = defineRoute({
  capability: Capability.REPORTS_VIEW,
  query: querySchema,
  handler: async ({ query, principal }) => {
    const scope = await participantScopeFilter(principal);
    const participants = await prisma.user.findMany({
      where: {
        ...scope,
        role: "PATIENT",
        deletedAt: null,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { profile: { participantCode: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, profile: { select: { participantCode: true } } },
      orderBy: { name: "asc" },
      take: 20,
    });
    return ok(participants);
  },
});
