"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

/**
 * A sortable column header.
 *
 * Renders a real button inside the `<th>` and sets `aria-sort`, so the sort
 * state is exposed to assistive technology rather than conveyed only by an
 * icon. Sorting is applied server-side via the query string.
 */
export function SortableHeader({
  field,
  label,
  align = "left",
  className,
}: {
  field: string;
  label: string;
  align?: "left" | "right";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeField = searchParams.get("sortBy");
  const activeOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const isActive = activeField === field;

  const nextOrder = isActive && activeOrder === "desc" ? "asc" : "desc";

  function handleSort() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", field);
    params.set("sortOrder", nextOrder);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const Icon = !isActive ? ChevronsUpDown : activeOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={isActive ? (activeOrder === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={handleSort}
        className={cn(
          "hover:text-ink -mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
          align === "right" && "ml-auto flex-row-reverse",
          isActive && "text-ink",
        )}
      >
        {label}
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">
          {isActive
            ? `Sorted ${activeOrder === "asc" ? "ascending" : "descending"}. Activate to sort ${nextOrder === "asc" ? "ascending" : "descending"}.`
            : `Activate to sort by ${label}`}
        </span>
      </button>
    </TableHead>
  );
}
