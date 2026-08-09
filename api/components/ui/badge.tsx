import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

/**
 * A small status label.
 *
 * `neutral` is the default on purpose: colour is reserved for states that
 * genuinely need attention. Turning every value into a bright badge destroys
 * the signal that colour is supposed to carry.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-muted border-line",
        primary: "bg-primary-soft text-primary border-primary-border",
        success: "bg-success-soft text-success border-transparent",
        warning: "bg-warning-soft text-warning border-transparent",
        danger: "bg-danger-soft text-danger border-transparent",
        info: "bg-info-soft text-info border-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** A filled dot, for status shown alongside a text label. */
export function StatusDot({
  tone = "neutral",
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const colours: Record<string, string> = {
    neutral: "bg-ink-subtle",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  };

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 rounded-full", colours[tone], className)}
    />
  );
}
