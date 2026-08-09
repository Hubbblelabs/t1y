import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Dense data table primitives.
 *
 * `TableScroll` provides the horizontal scroll container: on narrow viewports
 * the table scrolls inside its own region rather than forcing the whole page
 * to scroll sideways. It is focusable and labelled so keyboard and
 * screen-reader users can reach the overflow.
 */
export function TableScroll({ className, children, label }: {
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label ?? "Data table"}
      tabIndex={0}
      className={cn("w-full overflow-x-auto", className)}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-line hover:bg-surface-hover border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "text-ink-muted h-9 px-3 text-left align-middle text-xs font-medium tracking-wide whitespace-nowrap uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("text-ink px-3 py-2.5 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("text-ink-muted mt-3 text-xs", className)} {...props} />;
}
