"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const STORAGE_KEY = "admin-theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Private browsing, or storage blocked by policy. Not an error — the
    // toggle just stops remembering the choice between visits.
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark switch for the dashboard.
 *
 * The theme itself is applied by the inline script in the root layout, which
 * runs before first paint; this component only reflects and changes it. State
 * is initialised lazily from the same two sources the script reads, in the
 * same order, so React's first render always agrees with the DOM the script
 * produced and there is nothing to reconcile.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>(() => {
    // The server has no preference to read, and renders the light default.
    if (typeof window === "undefined") return "light";
    return readStoredTheme() ?? systemTheme();
  });

  // React's Strict Mode remount in development resets <html> to just the
  // attributes it manages from JSX, discarding the one the inline script set.
  // Re-applying it here restores it before paint. A no-op in production.
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Follow the OS while the admin has expressed no preference of their own,
  // so a laptop switching to dark at sunset carries the dashboard with it.
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() === null) setTheme(query.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // See readStoredTheme — the switch still works for this session.
    }
  }

  const goingTo = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={`Switch to ${goingTo} colours`}
      aria-label={`Switch to ${goingTo} colours`}
    >
      {theme === "dark" ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </Button>
  );
}
