import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Consistent page framing: breadcrumb, title, one-line description and a slot
 * for page-level actions. Every admin page uses it, so hierarchy reads the
 * same everywhere.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="text-ink-subtle flex flex-wrap items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                ) : null}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-ink underline-offset-4 hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink-muted">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-ink truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-ink-muted mt-1 text-[13px]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Standard page padding. Applied by every admin page's outermost element. */
export function PageContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto max-w-[100rem] p-4 lg:p-6", className)} {...props} />;
}

/** A titled band within a page, for grouping related blocks. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)} aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-ink text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-ink-muted mt-0.5 text-xs">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
