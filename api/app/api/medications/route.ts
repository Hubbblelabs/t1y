import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { createMedication, listMedications } from "@/lib/services/medications";
import { paginationSchema, toSkipTake } from "@/lib/validation/common";
import { createMedicationSchema } from "@/lib/validation/health";

const querySchema = z
  .object({
    activeOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .and(paginationSchema);

export const GET = defineRoute({
  query: querySchema,
  handler: async ({ principal, query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listMedications({
      userId: principal.userId,
      activeOnly: query.activeOnly,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: createMedicationSchema,
  handler: async ({ principal, body }) =>
    created(await createMedication(principal.userId, body)),
});
