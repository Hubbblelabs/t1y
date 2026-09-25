"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import type { CalculatorInput } from "@/lib/services/calculators";

interface Participant {
  id: string;
  name: string;
  email: string;
  profile: { participantCode: string } | null;
}

interface RunResult {
  calculator: { nameEn: string; noteEn: string | null };
  inputs: Array<{
    key: string;
    labelEn: string;
    unit: string;
    value: number | null;
    source: "OVERRIDE" | "DATA" | "MISSING";
    recordedAt: string | null;
    missingReason?: string;
  }>;
  results: Array<{ key: string; labelEn: string; unit: string; value: number }>;
  error: string | null;
}

/** ISO-8601 local value for a <input type="datetime-local">, defaulting to now. */
function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CalculatorRunPanel({
  calculatorId,
  inputs,
}: {
  calculatorId: string;
  inputs: CalculatorInput[];
}) {
  const [search, setSearch] = React.useState("");
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<Participant | null>(null);
  const [asOf, setAsOf] = React.useState(nowLocal());
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selected) return; // Don't re-search once someone is picked.
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/admin/calculators/participants?search=${encodeURIComponent(search)}`,
        );
        const json = await response.json();
        setParticipants(response.ok ? json.data : []);
      } catch {
        setParticipants([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search, selected]);

  async function run() {
    if (!selected) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const numericOverrides: Record<string, number> = {};
      for (const [key, value] of Object.entries(overrides)) {
        if (value.trim() !== "") numericOverrides[key] = Number(value);
      }

      const response = await fetch(`/api/admin/calculators/${calculatorId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          asOf: new Date(asOf).toISOString(),
          overrides: numericOverrides,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "This could not be run.");
        return;
      }
      setResult(json.data);
    } catch {
      setError("This could not be run. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="p-4">
        <h2 className="text-ink mb-3 font-semibold">1. Choose a participant</h2>

        {selected ? (
          <div className="bg-surface-hover flex items-start justify-between gap-2 rounded-md p-3">
            <div>
              <p className="text-ink text-sm font-medium">{selected.name}</p>
              <p className="text-ink-muted text-xs">{selected.email}</p>
              {selected.profile ? (
                <p className="text-ink-subtle text-xs">{selected.profile.participantCode}</p>
              ) : null}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelected(null);
                setResult(null);
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                className="text-ink-subtle absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                className="pl-9"
                placeholder="Search by name, email or participant code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {searching ? (
                <li className="text-ink-subtle p-2 text-sm">Searching…</li>
              ) : participants.length === 0 ? (
                <li className="text-ink-subtle p-2 text-sm">
                  {search ? "No one matches." : "Type to search participants."}
                </li>
              ) : (
                participants.map((participant) => (
                  <li key={participant.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(participant)}
                      className="hover:bg-surface-hover w-full rounded-md p-2 text-left"
                    >
                      <p className="text-ink text-sm font-medium">{participant.name}</p>
                      <p className="text-ink-muted text-xs">
                        {participant.email}
                        {participant.profile ? ` · ${participant.profile.participantCode}` : ""}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        <div className="border-line mt-4 border-t pt-4">
          <Field
            label="As of"
            htmlFor="calc-as-of"
            hint="Values are filled in from this child's own records at this moment — pick an earlier date to see what it would have shown then."
          >
            <Input
              id="calc-as-of"
              type="datetime-local"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="text-ink-muted mb-2 text-xs">
            Leave a number blank to use the value from their records; type one in to use that
            instead.
          </p>
          <div className="space-y-3">
            {inputs.map((input) => (
              <Field key={input.key} label={`${input.labelEn} (${input.unit})`} htmlFor={`ov-${input.key}`}>
                <Input
                  id={`ov-${input.key}`}
                  type="number"
                  inputMode="decimal"
                  placeholder={input.source === "DATA" ? "From records" : "Required"}
                  value={overrides[input.key] ?? ""}
                  onChange={(event) =>
                    setOverrides((current) => ({ ...current, [input.key]: event.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
        </div>

        <Button
          className="mt-4 w-full"
          variant="primary"
          onClick={run}
          disabled={!selected || running}
        >
          {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Work it out
        </Button>
        {error ? (
          <p role="alert" className="text-danger mt-2 text-sm">
            {error}
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-ink mb-3 font-semibold">2. Result</h2>

        {!result ? (
          <p className="text-ink-subtle text-sm">
            Choose a participant and click "Work it out" to see the numbers.
          </p>
        ) : result.error ? (
          <div className="bg-danger-soft text-danger rounded-md p-3 text-sm">{result.error}</div>
        ) : (
          <>
            <dl className="divide-line mb-4 divide-y">
              {result.results.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between py-2">
                  <dt className="text-ink text-sm">{row.labelEn}</dt>
                  <dd className="text-ink text-lg font-semibold tabular-nums">
                    {row.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {row.unit}
                  </dd>
                </div>
              ))}
            </dl>

            {result.calculator.noteEn ? (
              <p className="text-ink-muted mb-4 text-xs">{result.calculator.noteEn}</p>
            ) : null}

            <h3 className="text-ink-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              What went into it
            </h3>
            <ul className="text-ink-subtle space-y-1 text-xs">
              {result.inputs.map((row) => (
                <li key={row.key}>
                  {row.labelEn}: {row.value ?? "—"} {row.unit}
                  {" — "}
                  {row.source === "OVERRIDE"
                    ? "typed in"
                    : row.source === "DATA"
                      ? row.recordedAt
                        ? `from their records, recorded ${new Date(row.recordedAt).toLocaleString()}`
                        : "from their records"
                      : (row.missingReason ?? "missing")}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
