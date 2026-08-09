import * as React from "react";
import { AlertCircle, Inbox, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Loading, empty, error and unauthorised states.
 *
 * Every data-bearing surface in the dashboard uses these, so a slow query
 * shows structure rather than a blank screen, and a failure explains itself in
 * language a person can act on.
 */

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-surface-sunken animate-pulse rounded", className)}
      {...props}
    />
  );
}

/** Skeleton shaped like the table it replaces, to avoid layout shift. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-px" role="status" aria-label="Loading data">
      <div className="border-line flex gap-3 border-b px-3 py-2.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-line flex gap-3 border-b px-3 py-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className="h-3.5 flex-1"
              style={{ opacity: 1 - rowIndex * 0.06 }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data…</span>
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className="flex flex-col justify-end gap-2"
      style={{ height }}
    >
      <div className="flex flex-1 items-end gap-2">
        {[45, 70, 55, 85, 60, 92, 48, 75, 65, 80, 52, 70].map((value, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${value}%` }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
      <span className="sr-only">Loading chart…</span>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <Card className="p-5" role="status" aria-label="Loading statistic">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2.5 h-3 w-20" />
    </Card>
  );
}

/**
 * An empty state that says *why* it is empty and offers a way forward, rather
 * than printing "No data".
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-surface-sunken text-ink-subtle mb-4 rounded-full p-3">
        <Icon className="size-5" />
      </div>
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-ink-muted mt-1.5 max-w-sm text-[13px] leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * A user-facing error.
 *
 * `detail` is for a short, safe explanation. Internal exception text and
 * database errors must never be passed here — the API never returns them, and
 * the UI must not invent them.
 */
export function ErrorState({
  title = "Unable to load this information",
  detail = "Something went wrong while fetching the data. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-danger-soft text-danger mb-4 rounded-full p-3">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-ink-muted mt-1.5 max-w-sm text-[13px] leading-relaxed">{detail}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function UnauthorizedState({
  detail = "Your account does not have permission to view this information. Contact a super administrator if you believe this is a mistake.",
}: {
  detail?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="bg-surface-sunken text-ink-subtle mb-4 rounded-full p-3">
        <Lock className="size-5" />
      </div>
      <p className="text-ink text-sm font-medium">Access restricted</p>
      <p className="text-ink-muted mt-1.5 max-w-sm text-[13px] leading-relaxed">{detail}</p>
    </div>
  );
}
