"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const MIN = 12;

/** A signed-in staff member choosing a new password. */
export function ChangePasswordForm({ redirectTo = "/admin/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN) return setError(`Choose a password of at least ${MIN} characters.`);
    if (next !== confirm) return setError("The two new passwords do not match.");

    setPending(true);
    try {
      const response = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error?.issues?.[0]?.message ?? result?.error?.message ?? "The password could not be changed.");
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("The password could not be changed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Current (temporary) password" htmlFor="cp-current" required>
        <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={pending} />
      </Field>
      <Field label="New password" htmlFor="cp-new" required hint={`At least ${MIN} characters`}>
        <Input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={pending} />
      </Field>
      <Field label="Confirm new password" htmlFor="cp-confirm" required>
        <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={pending} />
      </Field>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Change password
      </Button>
    </form>
  );
}
