"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humaniseEnum } from "@/lib/utils/format";

const STATUSES = ["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED"] as const;
const DIABETES_TYPES = [
  "TYPE_1",
  "TYPE_2",
  "GESTATIONAL",
  "PREDIABETES",
  "MODY",
  "OTHER",
  "UNSPECIFIED",
] as const;

const ALL = "__all__";

/**
 * Search and filters for the participant table.
 *
 * The search box is debounced so typing does not fire a server round trip per
 * keystroke; every control writes to the query string, which is what the
 * server component reads.
 */
export function ParticipantFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const debounced = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("status") ?? ALL;
  const diabetesType = searchParams.get("diabetesType") ?? ALL;
  const hasFilters = Boolean(
    searchParams.get("search") ||
      searchParams.get("status") ||
      searchParams.get("diabetesType"),
  );

  const push = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounced.current) clearTimeout(debounced.current);

    debounced.current = setTimeout(() => {
      push((params) => {
        if (value.trim()) params.set("search", value.trim());
        else params.delete("search");
      });
    }, 350);
  }

  // Clear the pending debounce if the component unmounts mid-typing.
  React.useEffect(() => {
    return () => {
      if (debounced.current) clearTimeout(debounced.current);
    };
  }, []);

  function handleSelect(key: string, value: string) {
    push((params) => {
      if (value === ALL) params.delete(key);
      else params.set(key, value);
    });
  }

  function clearAll() {
    setSearch("");
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="border-line flex flex-wrap items-center gap-2.5 border-b p-4">
      <div className="relative min-w-52 flex-1">
        <Search
          className="text-ink-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by code, name or email"
          className="pl-8.5"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          aria-label="Search participants"
        />
      </div>

      <Select value={status} onValueChange={(value) => handleSelect("status", value)}>
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any status</SelectItem>
          {STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {humaniseEnum(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={diabetesType}
        onValueChange={(value) => handleSelect("diabetesType", value)}
      >
        <SelectTrigger className="w-44" aria-label="Filter by diabetes type">
          <SelectValue placeholder="Any type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any type</SelectItem>
          {DIABETES_TYPES.map((value) => (
            <SelectItem key={value} value={value}>
              {humaniseEnum(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
