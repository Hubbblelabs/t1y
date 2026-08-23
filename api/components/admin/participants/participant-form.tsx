"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

interface FormValue {
  email: string;
  firstName: string;
  lastName: string;
  diagnosisYear: string;
  phone: string;
}

const EMPTY: FormValue = { email: "", firstName: "", lastName: "", diagnosisYear: "", phone: "" };

/**
 * Enrols a participant from the admin side — the facility that was missing
 * entirely: the backend has always had `POST /api/admin/participants`, but
 * nothing in the dashboard called it.
 *
 * Two steps, not one screen, because they're genuinely different moments:
 * creating the record (a coordinator typing in details at a desk) and
 * activating it (handing a device to the family and giving them a
 * temporary password). Splitting them means a record can exist — visible,
 * searchable, editable — before anyone commits to activating app access
 * for it.
 */
export function ParticipantForm() {
  const router = useRouter();
  const [value, setValue] = React.useState<FormValue>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [created, setCreated] = React.useState<{ id: string; participantCode: string } | null>(
    null,
  );
  const [activating, setActivating] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function set<K extends keyof FormValue>(key: K, val: FormValue[K]) {
    setValue((prev) => ({ ...prev, [key]: val }));
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      email: value.email.trim(),
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      // This study is Type 1 only — see lib/config/study-scope.ts. Every
      // participant created here is TYPE_1; there is no type to choose.
      diabetesType: "TYPE_1" as const,
      diagnosisYear: value.diagnosisYear.trim() ? Number(value.diagnosisYear) : undefined,
      phone: value.phone.trim() || undefined,
    };

    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not create this participant.");
        const issues: Record<string, string> = {};
        for (const issue of body?.error?.issues ?? []) {
          issues[issue.field] = issue.message;
        }
        setFieldErrors(issues);
        return;
      }

      setCreated({ id: body.data.id, participantCode: body.data.profile?.participantCode ?? "—" });
    } catch {
      setError("Could not create this participant. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!created) return;
    setActivating(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/participants/${created.id}/activate`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not activate this participant.");
        return;
      }

      setTempPassword(body.data.tempPassword);
    } catch {
      setError("Could not activate this participant. Check your connection and try again.");
    } finally {
      setActivating(false);
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <div className="bg-success-soft flex size-8 items-center justify-center rounded-full">
            <Check className="text-success size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-ink text-sm font-semibold">
              Participant {created.participantCode} created
            </h2>
            <p className="text-ink-muted text-[13px]">
              {value.firstName} {value.lastName} — {value.email}
            </p>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
          >
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {tempPassword ? (
          <div className="border-line rounded-md border p-4">
            <p className="text-ink-muted mb-2 text-[13px]">
              One-time temporary password — shown once. Give it to the family now; it is not
              stored anywhere and cannot be shown again. They should change it after signing in.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-surface-hover flex-1 rounded-md px-3 py-2 font-mono text-sm tracking-wide">
                {tempPassword}
              </code>
              <Button size="sm" variant="secondary" onClick={copyPassword}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-ink-muted text-[13px]">
              The record exists but has no way to sign in yet — email delivery isn&apos;t
              configured for this deployment, so there is no verification link to send.
              Activating generates a temporary password to hand to the family directly (in
              person, at the clinic).
            </p>
            <Button onClick={handleActivate} disabled={activating}>
              {activating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              Activate &amp; issue temporary password
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/participants/${created.id}`)}>
            View participant
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreated(null);
              setTempPassword(null);
              setValue(EMPTY);
            }}
          >
            Enrol another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent/guardian email" htmlFor="email" error={fieldErrors.email} required className="sm:col-span-2">
          <Input
            id="email"
            type="email"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="parent@example.com"
          />
        </Field>

        <Field label="Child's first name" htmlFor="firstName" error={fieldErrors.firstName} required>
          <Input id="firstName" value={value.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>

        <Field label="Child's last name" htmlFor="lastName" error={fieldErrors.lastName} required>
          <Input id="lastName" value={value.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>

        <Field label="Diabetes type" htmlFor="diabetesType">
          <div className="flex h-9 items-center">
            <Badge tone="neutral">Type 1</Badge>
            <span className="text-ink-subtle ml-2 text-[12px]">
              This study is Type 1 only — nothing else to choose.
            </span>
          </div>
        </Field>

        <Field label="Diagnosis year" htmlFor="diagnosisYear" error={fieldErrors.diagnosisYear}>
          <Input
            id="diagnosisYear"
            type="number"
            value={value.diagnosisYear}
            onChange={(e) => set("diagnosisYear", e.target.value)}
            placeholder={String(new Date().getFullYear())}
          />
        </Field>

        <Field label="Phone (optional)" htmlFor="phone" error={fieldErrors.phone}>
          <Input id="phone" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>

      <div>
        <Button
          onClick={handleCreate}
          disabled={saving || !value.email.trim() || !value.firstName.trim() || !value.lastName.trim()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          Create participant
        </Button>
      </div>
    </Card>
  );
}
