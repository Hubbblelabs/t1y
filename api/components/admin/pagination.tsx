"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/api/response";

/**
 * Server-pagination controls.
 *
 * The page number lives in the query string so a given page is linkable and
 * survives a refresh. The live region announces the range to screen readers as
 * it changes.
 */
export function Pagination({ pagination }: { pagination: PaginationMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-ink-muted text-xs" aria-live="polite">
        Showing <span className="tabular font-medium">{first}</span>–
        <span className="tabular font-medium">{last}</span> of{" "}
        <span className="tabular font-medium">{pagination.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasPreviousPage}
          onClick={() => goTo(pagination.page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>

        <span className="text-ink-muted px-1 text-xs">
          Page <span className="tabular">{pagination.page}</span> of{" "}
          <span className="tabular">{Math.max(1, pagination.totalPages)}</span>
        </span>

        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasNextPage}
          onClick={() => goTo(pagination.page + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
