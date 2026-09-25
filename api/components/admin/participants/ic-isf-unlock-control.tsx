"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Calculator, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Per-child gate for the app's IC/ISF calculator (see `Profile.icIsfUnlocked`).
 *
 * The app's own "why is this locked?" explainer already tells families this
 * exact flow: share the child's IC ratio and ISF with the coordinator, who
 * records them and enables the calculator. This is that switch — it didn't
 * exist before, so the explainer was describing a process with nothing
 * behind it.
 */
export function IcIsfUnlockControl({
  participantId,
  unlocked,
}: {
  participantId: string;
  unlocked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { icIsfUnlocked: !unlocked } }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not update this setting.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Calculator
          className={unlocked ? "text-success mt-0.5 size-4 shrink-0" : "text-ink-muted mt-0.5 size-4 shrink-0"}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-ink text-[13px] font-medium">
            {unlocked ? "IC / ISF calculator unlocked" : "IC / ISF calculator locked"}
          </p>
          <p className="text-ink-muted mt-0.5 text-[13px]">
            {unlocked
              ? "This family can use the app's insulin-to-carb and correction-factor calculator."
              : "Locked until the care team's IC ratio and ISF for this child are on file and confirmed."}
          </p>
          {error ? (
            <div
              role="alert"
              className="bg-danger-soft text-danger mt-2 flex items-start gap-2 rounded-md p-2.5 text-[13px]"
            >
              <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          <Button
            size="sm"
            variant={unlocked ? "secondary" : "primary"}
            className="mt-2.5"
            onClick={handleToggle}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {unlocked ? "Lock it again" : "Unlock for this child"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
