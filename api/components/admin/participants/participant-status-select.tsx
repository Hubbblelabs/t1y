"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/badge";

type Status = "PENDING" | "ACTIVE" | "INACTIVE";

const LABELS: Record<Status, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

const TONE: Record<Status, "success" | "warning" | "neutral"> = {
  PENDING: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
};

/**
 * Same PENDING→ACTIVE/INACTIVE, ACTIVE⇄INACTIVE state machine as
 * `ParticipantStatusControl` on the detail page, condensed into one dropdown
 * so an admin can change a participant's status without leaving the table.
 * The current status is always the first, already-selected option; the other
 * option(s) are the only transitions this status machine allows from here.
 */
function optionsFor(status: Status): Status[] {
  if (status === "PENDING") return ["PENDING", "ACTIVE", "INACTIVE"];
  if (status === "ACTIVE") return ["ACTIVE", "INACTIVE"];
  return ["INACTIVE", "ACTIVE"];
}

export function ParticipantStatusSelect({
  participantId,
  status,
}: {
  participantId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function handleChange(next: string) {
    if (next === status || busy) return;
    setBusy(true);
    setError(null);

    try {
      if (status === "PENDING" && next === "ACTIVE") {
        const response = await fetch(`/api/admin/participants/${participantId}/activate`, {
          method: "POST",
        });
        const body = await response.json();
        if (!response.ok) {
          setError(body?.error?.message ?? "Could not activate this participant.");
          return;
        }
        if (body.data.tempPassword) {
          // Held here instead of refreshing immediately — refreshing would
          // re-fetch the row with its new status and this one-time password
          // would never have been shown.
          setTempPassword(body.data.tempPassword);
          return;
        }
      } else {
        const response = await fetch(`/api/admin/participants/${participantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const body = await response.json();
        if (!response.ok) {
          setError(body?.error?.message ?? "Could not update status.");
          return;
        }
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (tempPassword) {
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <code className="bg-surface-sunken rounded px-1.5 py-0.5 font-mono text-xs">
          {tempPassword}
        </code>
        <button
          type="button"
          className="text-ink-muted hover:text-ink"
          onClick={async () => {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          title="Copy password"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        <button
          type="button"
          className="text-primary text-xs underline underline-offset-2"
          onClick={() => {
            setTempPassword(null);
            router.refresh();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Select value={status} onValueChange={handleChange} disabled={busy}>
        <SelectTrigger className="h-7 w-32 gap-1.5 px-2 text-xs" onClick={(e) => e.stopPropagation()}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <StatusDot tone={TONE[status]} />
          )}
          <SelectValue />
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          {optionsFor(status).map((option) => (
            <SelectItem key={option} value={option}>
              {LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="text-danger text-[11px]">{error}</span> : null}
    </div>
  );
}
