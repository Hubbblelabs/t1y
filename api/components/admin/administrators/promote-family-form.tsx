"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpCircle, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

interface Found {
  id: string;
  name: string;
  email: string;
}

/**
 * A person already using the app as a family can also be given dashboard
 * access — creating a brand-new staff account rejects an email already in
 * use (see AddStaffForm / createStaffMember), so this is the other path for
 * that same email.
 *
 * There is no dual role here: converting looks the family account up by
 * email, then switches its role from family to staff in place — same login,
 * same password. Afterwards that email can no longer sign in to the app as
 * that child, only to this dashboard, which is why this asks for an explicit
 * confirmation rather than doing it in one step like AddStaffForm.
 */
export function PromoteFamilyForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [looking, setLooking] = React.useState(false);
  const [found, setFound] = React.useState<Found | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  async function lookUp() {
    setError(null);
    setFound(null);
    setConfirming(false);
    setLooking(true);
    try {
      const response = await fetch(
        `/api/admin/admins/promote?email=${encodeURIComponent(email.trim())}`,
      );
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "No family account found with that email.");
        return;
      }
      setFound(body.data);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLooking(false);
    }
  }

  async function promote() {
    if (!found) return;
    setPromoting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/admins/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: found.id }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "This account could not be converted.");
        return;
      }
      setDone(found.email);
      setFound(null);
      setConfirming(false);
      setEmail("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPromoting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ArrowUpCircle className="size-4" aria-hidden="true" />
        Give a family account admin access
      </Button>
    );
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="text-ink mb-1 text-sm font-semibold">Give a family account admin access</h2>
      <p className="text-ink-muted mb-4 text-xs">
        For someone already signed up as a parent who also needs to use this dashboard.
      </p>

      {done ? (
        <p className="bg-success-soft text-success mb-4 rounded-md p-3 text-sm">
          {done} can now sign in to this dashboard.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Field label="Their email address" htmlFor="promote-email" className="flex-1">
          <Input
            id="promote-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFound(null);
              setConfirming(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && lookUp()}
          />
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="mt-6 self-start"
          onClick={lookUp}
          disabled={looking || !email.trim()}
        >
          {looking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          Look up
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      {found ? (
        <div className="bg-warning-soft mt-4 rounded-md p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p>
                Found <span className="font-semibold">{found.name}</span> ({found.email}), a family
                account.
              </p>
              <p className="text-ink-muted mt-1 text-xs">
                Giving them admin access converts this account to staff. Afterwards this email can
                no longer sign in to the app as that child — only to this dashboard.
              </p>
            </div>
          </div>

          {confirming ? (
            <div className="mt-3 flex gap-2">
              <Button variant="danger" size="sm" onClick={promote} disabled={promoting}>
                {promoting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Yes, convert to a staff account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={promoting}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setConfirming(true)}
            >
              Give admin access
            </Button>
          )}
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="mt-4"
        onClick={() => {
          setOpen(false);
          setFound(null);
          setError(null);
          setDone(null);
          setEmail("");
        }}
      >
        Close
      </Button>
    </Card>
  );
}
