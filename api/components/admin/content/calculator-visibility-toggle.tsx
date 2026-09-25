"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Switch } from "@/components/ui/switch";

/**
 * Shows or hides a calculator in the app.
 *
 * The only thing about a stored calculator that can change — its sums are
 * fixed when it is created (see lib/services/calculators.ts). Hiding is
 * therefore how a calculator is withdrawn: nothing is deleted, so the
 * arithmetic a family saw stays on the record.
 */
export function CalculatorVisibilityToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(active);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(next: boolean) {
    const previous = checked;
    setChecked(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/calculators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!response.ok) {
        setChecked(previous);
        const json = await response.json().catch(() => null);
        setError(json?.error?.message ?? "Could not change this.");
        return;
      }
      router.refresh();
    } catch {
      setChecked(previous);
      setError("Could not change this. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <label className="flex items-center gap-2">
        <span className="text-ink-muted text-sm">Show in the app</span>
        <Switch checked={checked} onCheckedChange={toggle} disabled={pending} />
      </label>
      {error ? (
        <span role="alert" className="text-danger text-xs font-semibold">
          {error}
        </span>
      ) : null}
    </div>
  );
}
