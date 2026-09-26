"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Permanently removes a participant — the same anonymise-and-scrub routine a
 * family's own "Correct or delete your data" uses (see
 * lib/services/users.ts's deleteOwnAccount), just triggered by staff instead
 * of the family themselves. A two-step confirm, since there is no undo.
 */
export function ParticipantDeleteControl({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/participants/${participantId}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not delete this participant.");
        return;
      }
      router.push("/admin/participants");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/30 p-4">
      <div className="flex items-start gap-3">
        <Trash2 className="text-danger mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-ink text-xs font-medium">Delete this participant</p>
          <p className="text-ink-muted mt-0.5 text-xs">
            Removes their name and contact details permanently. This cannot be undone.
          </p>
          {error ? (
            <div
              role="alert"
              className="bg-danger-soft text-danger mt-2 flex items-start gap-2 rounded-md p-2.5 text-xs"
            >
              <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {confirming ? (
            <div className="mt-2.5 flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Yes, delete permanently
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2.5"
              onClick={() => setConfirming(true)}
            >
              Delete participant
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
