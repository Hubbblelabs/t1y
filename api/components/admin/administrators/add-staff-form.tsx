"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { CapabilityGroupPicker } from "./capability-group-picker";
import type { CapabilityValue } from "@/lib/permissions/roles";

/** A readable temporary password: no look-alike characters, 14 long. */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

/**
 * Adds a staff account with a temporary password. The person is made to choose
 * their own the first time they sign in, and can change it any time from
 * Your account.
 */
export function AddStaffForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [capabilities, setCapabilities] = React.useState<CapabilityValue[]>([]);
  const [password, setPassword] = React.useState(generatePassword);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ email: string; password: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role: "ADMIN",
          password,
          jobTitle: jobTitle.trim() || undefined,
          capabilities,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const issue = result?.error?.issues?.[0]?.message;
        setError(issue ?? result?.error?.message ?? "The account could not be created.");
        return;
      }
      setCreated({ email: email.trim(), password });
      setName("");
      setEmail("");
      setJobTitle("");
      setCapabilities([]);
      setPassword(generatePassword());
      router.refresh();
    } catch {
      setError("The account could not be created. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        Add a staff account
      </Button>
    );
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="text-ink mb-1 text-sm font-semibold">Add a staff account</h2>
      <p className="text-ink-muted mb-4 text-xs">
        Give them the temporary password below. They will be asked to choose their
        own the first time they sign in, and can change it later from Your account.
      </p>

      {created ? (
        <div className="bg-success-soft text-success mb-4 flex items-start gap-2 rounded-md p-3 text-sm">
          <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Account created</p>
            <p>
              Email: <span className="font-mono">{created.email}</span>
            </p>
            <p>
              Temporary password: <span className="font-mono">{created.password}</span>
            </p>
            <p className="mt-1 text-xs">This is shown once. Copy it now and pass it on.</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" htmlFor="staff-name" required>
          <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
        </Field>
        <Field label="Email address" htmlFor="staff-email" required>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Job title" htmlFor="staff-title" hint="Optional">
          <Input id="staff-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={pending} />
        </Field>
        <Field label="Temporary password" htmlFor="staff-password" required hint="At least 8 characters">
          <div className="flex gap-2">
            <Input
              id="staff-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className="font-mono"
            />
            <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())} disabled={pending}>
              New
            </Button>
          </div>
        </Field>

        <div className="sm:col-span-2">
          <CapabilityGroupPicker
            capabilities={capabilities}
            onChange={setCapabilities}
            disabled={pending}
          />
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" disabled={pending || !name.trim() || !email.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Create account
          </Button>
          <Button type="button" variant="secondary" onClick={() => { setOpen(false); setCreated(null); }}>
            Close
          </Button>
        </div>
      </form>
    </Card>
  );
}
