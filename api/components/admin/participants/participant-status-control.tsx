"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, KeyRound, Loader2, PowerOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Status = "PENDING" | "ACTIVE" | "INACTIVE";

type Outcome =
  | { kind: "activated"; tempPassword: string | null }
  | { kind: "deactivated" }
  | { kind: "reactivated" };

/**
 * The participant status control — one fixed transition per state, not a
 * free-form status picker:
 *
 *   PENDING  --Accept-->  ACTIVE     (or --Reject--> INACTIVE)
 *   ACTIVE   --Deactivate--> INACTIVE
 *   INACTIVE --Reactivate--> ACTIVE
 *
 * SUSPENDED exists in the schema for other reasons (abuse, security) but is
 * deliberately not reachable from here — this is the day-to-day enrolment
 * toggle, not a general status editor.
 */
export function ParticipantStatusControl({
  participantId,
  status,
}: {
  participantId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"accept" | "reject" | "toggle" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  async function patchStatus(newStatus: "ACTIVE" | "INACTIVE") {
    const response = await fetch(`/api/admin/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "Could not update status.");
  }

  async function handleAccept() {
    setBusy("accept");
    setError(null);
    try {
      const response = await fetch(`/api/admin/participants/${participantId}/activate`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not activate this participant.");
        return;
      }
      // Not calling router.refresh() yet — see the "Done" button below. This
      // page only renders this control while it matches the current status,
      // so refreshing immediately would unmount it before a one-time
      // temporary password could be read or copied.
      setOutcome({ kind: "activated", tempPassword: body.data.tempPassword });
    } catch {
      setError("Could not activate this participant. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    setError(null);
    try {
      await patchStatus("INACTIVE");
      setOutcome({ kind: "deactivated" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject this enrolment.");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggle() {
    setBusy("toggle");
    setError(null);
    const target = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await patchStatus(target);
      setOutcome(target === "ACTIVE" ? { kind: "reactivated" } : { kind: "deactivated" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setBusy(null);
    }
  }

  async function copyPassword(tempPassword: string) {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (outcome?.kind === "activated") {
    return (
      <Card className="border-warning/40 bg-warning-soft/40 p-4">
        <div className="flex items-start gap-2">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-ink text-[13px] font-medium">Account activated.</p>
            {outcome.tempPassword ? (
              <>
                <p className="text-ink-muted mt-1 text-[13px]">
                  Temporary password — shown once, give it to the family now.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-surface flex-1 rounded-md px-3 py-1.5 font-mono text-sm tracking-wide">
                    {outcome.tempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyPassword(outcome.tempPassword!)}
                  >
                    {copied ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-ink-subtle mt-2 text-[12px]">
                  Copy it before continuing — this panel won&apos;t show it again. They&apos;ll
                  be asked to set their own password the first time they sign in with it.
                </p>
              </>
            ) : (
              <p className="text-ink-muted mt-1 text-[13px]">
                This person already had a password from signing up themselves — it was left
                untouched. They can sign in with it now.
              </p>
            )}
            <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => { setOutcome(null); router.refresh(); }}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (outcome?.kind === "deactivated") {
    return (
      <Card className="border-danger/40 bg-danger-soft/40 p-4">
        <div className="flex items-start gap-2">
          <X className="text-danger mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-ink text-[13px] font-medium">
              {status === "PENDING" ? "Enrolment rejected." : "Account deactivated."}
            </p>
            <p className="text-ink-muted mt-1 text-[13px]">
              Set to Inactive — nothing was deleted, and this can be reversed at any time.
            </p>
            <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => { setOutcome(null); router.refresh(); }}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (outcome?.kind === "reactivated") {
    return (
      <Card className="border-warning/40 bg-warning-soft/40 p-4">
        <div className="flex items-start gap-2">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-ink text-[13px] font-medium">Account reactivated.</p>
            <p className="text-ink-muted mt-1 text-[13px]">
              Their existing password still works — nothing was reset.
            </p>
            <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => { setOutcome(null); router.refresh(); }}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const errorBanner = error ? (
    <div
      role="alert"
      className="bg-danger-soft text-danger mt-2 flex items-start gap-2 rounded-md p-2.5 text-[13px]"
    >
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null;

  if (status === "PENDING") {
    return (
      <Card className="border-warning/40 bg-warning-soft/40 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-ink text-[13px] font-medium">Awaiting a decision</p>
            <p className="text-ink-muted mt-0.5 text-[13px]">
              This account is Pending and cannot sign in. Accept to grant app access — either a
              temporary password (no credential yet) or verifying it in place of an unreachable
              confirmation email (already self-registered). Reject to decline the enrolment;
              nothing is deleted.
            </p>
            {errorBanner}
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" onClick={handleAccept} disabled={busy !== null}>
                {busy === "accept" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                Accept
              </Button>
              <Button size="sm" variant="secondary" onClick={handleReject} disabled={busy !== null}>
                {busy === "reject" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="size-4" aria-hidden="true" />
                )}
                Reject
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ACTIVE or INACTIVE — a single toggle, not a status picker.
  const isActive = status === "ACTIVE";
  return (
    <Card className="border-line p-4">
      <div className="flex items-start gap-3">
        <PowerOff
          className={isActive ? "text-ink-muted mt-0.5 size-4 shrink-0" : "text-danger mt-0.5 size-4 shrink-0"}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-ink text-[13px] font-medium">
            {isActive ? "Account is active" : "Account is inactive"}
          </p>
          <p className="text-ink-muted mt-0.5 text-[13px]">
            {isActive
              ? "Deactivating blocks sign-in without deleting anything. Reversible at any time."
              : "This account can't sign in right now. Reactivating restores access with their existing password."}
          </p>
          {errorBanner}
          <Button
            size="sm"
            variant={isActive ? "secondary" : "primary"}
            className="mt-2.5"
            onClick={handleToggle}
            disabled={busy !== null}
          >
            {busy === "toggle" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PowerOff className="size-4" aria-hidden="true" />
            )}
            {isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
