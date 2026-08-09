import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { listNotifications } from "@/lib/services/notifications";
import { paginationSchema, toSkipTake } from "@/lib/validation/common";

const querySchema = z
  .object({
    unreadOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .and(paginationSchema);

/** The caller's notification inbox, newest first. */
export const GET = defineRoute({
  query: querySchema,
  handler: async ({ principal, query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total, unreadCount } = await listNotifications({
      userId: principal.userId,
      unreadOnly: query.unreadOnly,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      unreadCount,
    });
  },
});
