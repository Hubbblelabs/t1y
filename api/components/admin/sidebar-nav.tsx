"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { isActivePath, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Sidebar navigation.
 *
 * Expandable sections are `<button aria-expanded>` controlling a region, and
 * the active page is marked with `aria-current="page"` so assistive technology
 * reports position without relying on the colour treatment.
 */
export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3 py-3">
      {sections.map((section) => {
        if (section.href) {
          const active = isActivePath(pathname, section.href, section.matchPrefix);
          return (
            <Link
              key={section.href}
              href={section.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              <section.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{section.label}</span>
            </Link>
          );
        }

        return (
          <NavGroup
            key={section.label}
            section={section}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}

function NavGroup({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  const containsActive =
    section.items?.some((item) => isActivePath(pathname, item.href, item.matchPrefix)) ??
    false;

  // Open by default when the current page is inside the group, so a deep link
  // reveals its own context.
  const [open, setOpen] = React.useState(containsActive);
  React.useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const panelId = `nav-${section.label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          containsActive
            ? "text-ink font-medium"
            : "text-ink-muted hover:bg-surface-hover hover:text-ink",
        )}
      >
        <section.icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{section.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      <div id={panelId} hidden={!open} className="mt-0.5 space-y-0.5 pb-1">
        {section.items?.map((item) => {
          const active = isActivePath(pathname, item.href, item.matchPrefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "ml-[1.4rem] block rounded-md border-l py-1.5 pl-3.5 text-[13px] transition-colors",
                active
                  ? "border-primary text-primary font-medium"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
