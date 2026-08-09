"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, LogOut, Menu, User } from "lucide-react";

import { SidebarNav } from "@/components/admin/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { NavSection } from "@/lib/navigation";
import { signOut } from "@/lib/auth/client";

/**
 * The application frame.
 *
 * Desktop keeps a persistent sidebar; below `lg` it collapses into a drawer
 * rather than a squashed copy of the desktop layout. The main region is the
 * only scroll container, so the sidebar and header stay put on long tables.
 */
export function AdminShell({
  sections,
  user,
  children,
}: {
  sections: NavSection[];
  user: { name: string; email: string; roleLabel: string };
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="bg-canvas flex h-dvh overflow-hidden">
      <a
        href="#main-content"
        className="sr-only-focusable bg-primary text-ink-inverse absolute top-3 left-3 z-50 rounded-md px-3 py-2 text-sm"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="border-line bg-surface hidden w-60 shrink-0 flex-col border-r lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
        <ProductNote />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" title="Navigation" className="p-0">
              <Brand />
              <div className="flex-1 overflow-y-auto">
                <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <span className="text-ink text-sm font-semibold">Diabetes Platform</span>
          </div>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="bg-primary-soft text-primary flex size-6 items-center justify-center rounded-full text-[11px] font-semibold">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-36 truncate sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <span className="text-ink block truncate text-[13px] font-medium">
                  {user.name}
                </span>
                <span className="text-ink-subtle block truncate text-xs font-normal">
                  {user.email}
                </span>
                <span className="text-ink-subtle mt-1 block text-xs font-normal">
                  {user.roleLabel}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/account">
                  <User className="size-4" />
                  Your account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="border-line flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
      <span className="bg-primary text-ink-inverse flex size-7 items-center justify-center rounded-md">
        <Activity className="size-4" aria-hidden="true" />
      </span>
      <span className="text-ink truncate text-sm font-semibold">Diabetes Platform</span>
    </div>
  );
}

/**
 * A standing reminder of the product boundary, kept visible in the chrome
 * rather than buried in documentation.
 */
function ProductNote() {
  return (
    <div className="border-line text-ink-subtle border-t px-4 py-3 text-[11px] leading-relaxed">
      Records and reports tracked data. It does not diagnose, prescribe, or
      replace clinical judgement.
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
