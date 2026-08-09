"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_LABELS, type DateRangePreset } from "@/lib/validation/common";

const PRESETS: DateRangePreset[] = ["7d", "30d", "90d", "6m", "1y", "all"];

/**
 * Period selector.
 *
 * The selection lives in the URL, so a chosen range survives a refresh and can
 * be shared or bookmarked. Server components read the same query string, which
 * keeps the displayed period and the queried period in step.
 */
export function DateRangePicker({ paramName = "range" }: { paramName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  const current = (searchParams.get(paramName) ?? "30d") as DateRangePreset;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, value);
    // Changing the period restarts pagination.
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-40" aria-label="Select date range">
        <CalendarRange className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {DATE_RANGE_LABELS[preset]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
