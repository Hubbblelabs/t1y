import {
  dateRangeSchema,
  paginationSchema,
  resolveDateRange,
  searchSchema,
} from "@/lib/validation/common";
import { z } from "zod";

/**
 * Parses the query string shared by every browse page (period, search,
 * pagination) into concrete values.
 *
 * Invalid input falls back to defaults rather than throwing: a hand-edited URL
 * should show the default view, not an error page.
 */
const browseSchema = z
  .object({ search: searchSchema })
  .and(paginationSchema)
  .and(dateRangeSchema);

export interface BrowseParams {
  from: Date;
  to: Date;
  search?: string;
  page: number;
  skip: number;
  take: number;
}

export function parseBrowseParams(
  searchParams: Record<string, string | string[] | undefined>,
): BrowseParams {
  const parsed = browseSchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : browseSchema.parse({});
  const { from, to } = resolveDateRange(query);

  return {
    from,
    to,
    search: query.search,
    page: query.page,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}
