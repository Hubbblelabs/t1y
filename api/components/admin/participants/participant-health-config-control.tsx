"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertCircle, Loader2 } from "lucide-react";

import { HealthConfigEditor } from "@/components/admin/participants/health-config-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GLUCOSE_SLOT_KEYS,
  type GlucoseSlotKey,
  type HealthDataConfig,
} from "@/lib/health-data-config";

function same(a: HealthDataConfig, b: HealthDataConfig): boolean {
  return (
    a.insulinIntervalHours === b.insulinIntervalHours &&
    a.exerciseEnabled === b.exerciseEnabled &&
    a.exerciseReminderHours === b.exerciseReminderHours &&
    a.glucoseSlots.length === b.glucoseSlots.length &&
    a.glucoseSlots.every((s) => b.glucoseSlots.includes(s))
  );
}

/** One participant's health-data configuration — what the app asks this family to record. */
export function ParticipantHealthConfigControl({
  participantId,
  config,
}: {
  participantId: string;
  config: HealthDataConfig;
}) {
  const router = useRouter();
  const initial = React.useMemo<HealthDataConfig>(
    () => ({
      ...config,
      glucoseSlots: config.glucoseSlots.filter((s): s is GlucoseSlotKey =>
        (GLUCOSE_SLOT_KEYS as readonly string[]).includes(s),
      ),
    }),
    [config],
  );
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const dirty = !same(value, initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: value }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not update this.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="text-ink-muted size-4 shrink-0" aria-hidden="true" />
        <h2 className="text-ink text-xs font-medium">Health data to collect</h2>
      </div>
      <HealthConfigEditor
        value={value}
        onChange={(next) => {
          setSaved(false);
          setValue(next);
        }}
        disabled={busy}
      />

      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger mt-2 flex items-start gap-2 rounded-md p-2.5 text-xs"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {dirty ? (
        <Button size="sm" variant="primary" className="mt-3" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      ) : saved ? (
        <p className="text-success mt-3 text-xs">Saved. The app picks this up next time it opens or refreshes.</p>
      ) : null}
    </Card>
  );
}
