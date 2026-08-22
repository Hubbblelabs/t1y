"use client";

import * as React from "react";
import { AlertCircle, Check, Download, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

interface RowOutcome {
  row: number;
  email: string;
  participantCode?: string;
  reason?: string;
}

interface ImportResult {
  created: RowOutcome[];
  skipped: RowOutcome[];
}

/** Same alphabet as the single-participant temp password, for consistency. */
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateDummyPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

/**
 * Bulk participant import: download the sample sheet, fill it in, upload it
 * back with one shared "dummy" password for the whole batch. Every account
 * created this way is flagged to force a password change on first sign-in
 * (see `ChangePasswordScreen` in the mobile app) — the dummy password is a
 * handoff mechanism, never meant to be kept.
 */
export function BulkImportForm() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileBase64, setFileBase64] = React.useState<string | null>(null);
  const [dummyPassword, setDummyPassword] = React.useState(() => generateDummyPassword());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  function handleFile(file: File | undefined) {
    setResult(null);
    setError(null);
    if (!file) {
      setFileName(null);
      setFileBase64(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFileBase64(dataUrl.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!fileBase64) {
      setError("Choose a filled-in .xlsx file first.");
      return;
    }
    if (dummyPassword.length < 12) {
      setError("The shared password must be at least 12 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/participants/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, dummyPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not import this file.");
        return;
      }
      setResult(body.data as ImportResult);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-ink mb-1 text-sm font-semibold">1. Download the sample sheet</h2>
        <p className="text-ink-muted mb-3 text-[13px]">
          One row per child — email, name, date of birth and diagnosis year. Fill in as many rows
          as you need and re-upload it below.
        </p>
        <a href="/api/admin/participants/bulk/template">
          <Button variant="secondary" size="sm">
            <Download className="size-4" aria-hidden="true" />
            Download template (.xlsx)
          </Button>
        </a>
      </Card>

      <Card className="p-5">
        <h2 className="text-ink mb-1 text-sm font-semibold">2. Set a shared temporary password</h2>
        <p className="text-ink-muted mb-3 text-[13px]">
          Every account this batch creates gets this same password to start. Everyone is required
          to set their own password the first time they sign in — this one is only for handoff.
        </p>
        <div className="flex max-w-sm items-end gap-2">
          <Field label="Temporary password" htmlFor="dummy-password" className="flex-1">
            <Input
              id="dummy-password"
              value={dummyPassword}
              onChange={(e) => setDummyPassword(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDummyPassword(generateDummyPassword())}
          >
            Regenerate
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-ink mb-1 text-sm font-semibold">3. Upload the completed sheet</h2>
        <p className="text-ink-muted mb-3 text-[13px]">
          Up to 1,000 rows per upload. Rows with a problem (bad email, missing field, an email
          already in use) are skipped and listed below — the rest are still created.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Choose file
          </Button>
          <span className="text-ink-muted text-[13px]">{fileName ?? "No file chosen"}</span>
        </div>

        {error ? (
          <div
            role="alert"
            className="bg-danger-soft text-danger mt-3 flex items-start gap-2 rounded-md p-2.5 text-[13px]"
          >
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button className="mt-4" onClick={handleSubmit} disabled={submitting || !fileBase64}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          Import participants
        </Button>
      </Card>

      {result ? <ResultSummary result={result} dummyPassword={dummyPassword} /> : null}
    </div>
  );
}

function ResultSummary({
  result,
  dummyPassword,
}: {
  result: ImportResult;
  dummyPassword: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-2">
        <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-ink text-[13px] font-medium">
            {result.created.length} participant{result.created.length === 1 ? "" : "s"} created
            {result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}.
          </p>
          <p className="text-ink-muted mt-1 text-[13px]">
            Shared password for this batch:{" "}
            <code className="bg-surface rounded px-1.5 py-0.5 font-mono">{dummyPassword}</code> —
            copy it now before leaving this page.
          </p>
        </div>
      </div>

      {result.created.length > 0 ? (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-ink-subtle border-line border-b">
                <th className="py-1.5 pr-4 font-medium">Row</th>
                <th className="py-1.5 pr-4 font-medium">Email</th>
                <th className="py-1.5 font-medium">Participant code</th>
              </tr>
            </thead>
            <tbody>
              {result.created.map((row) => (
                <tr key={row.row} className="border-line/60 border-b last:border-0">
                  <td className="text-ink-muted py-1.5 pr-4">{row.row}</td>
                  <td className="text-ink py-1.5 pr-4">{row.email}</td>
                  <td className="text-ink py-1.5">{row.participantCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result.skipped.length > 0 ? (
        <div className="overflow-x-auto">
          <p className="text-ink mb-2 text-[13px] font-medium">Skipped rows</p>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-ink-subtle border-line border-b">
                <th className="py-1.5 pr-4 font-medium">Row</th>
                <th className="py-1.5 pr-4 font-medium">Email</th>
                <th className="py-1.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.skipped.map((row) => (
                <tr key={row.row} className="border-line/60 border-b last:border-0">
                  <td className="text-ink-muted py-1.5 pr-4">{row.row}</td>
                  <td className="text-ink py-1.5 pr-4">{row.email || "—"}</td>
                  <td className="text-danger py-1.5">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
