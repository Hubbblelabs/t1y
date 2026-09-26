"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PowerOff, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The deactivate/reactivate action the administrators list has always
 * described (see the page's own note about ending sessions immediately) but
 * never actually offered a button for.
 *
 * Deactivating calls DELETE — never a hard delete, see
 * lib/services/admins.ts's deactivateStaffMember — which also revokes every
 * session immediately. Reactivating is a plain status change back to ACTIVE.
 */
export function StaffRowActions({
  staffId,
  status,
  isSelf,
}: {
  staffId: string;
  status: string;
  /** The signed-in administrator cannot deactivate their own account. */
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function deactivate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/admins/${staffId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not deactivate this account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/admins/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not reactivate this account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (isSelf) return <span className="text-ink-subtle text-xs">You</span>;

  if (error) {
    return <span className="text-danger text-xs">{error}</span>;
  }

  if (status !== "ACTIVE" && status !== "PENDING") {
    return (
      <Button variant="ghost" size="sm" onClick={reactivate} disabled={busy}>
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-3.5" aria-hidden="true" />
        )}
        Reactivate
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="danger" size="sm" onClick={deactivate} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Confirm
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      <PowerOff className="size-3.5" aria-hidden="true" />
      Deactivate
    </Button>
  );
}
