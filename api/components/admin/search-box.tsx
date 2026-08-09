"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Debounced search bound to the `search` query parameter.
 *
 * Changing the term resets pagination — staying on page 4 of a different
 * result set is never what the user meant.
 */
export function SearchBox({
  placeholder = "Search",
  paramName = "search",
  label = "Search",
}: {
  placeholder?: string;
  paramName?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = React.useState(searchParams.get(paramName) ?? "");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set(paramName, next.trim());
      else params.delete(paramName);
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
  }

  return (
    <div className="relative max-w-sm">
      <Search
        className="text-ink-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        className="pl-8.5"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  );
}
