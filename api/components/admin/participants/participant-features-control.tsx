"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ListChecks, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ALL_PARTICIPANT_FEATURES,
  PARTICIPANT_FEATURE_LABELS,
  type ParticipantFeatureKey,
} from "@/lib/participant-feature-registry";

/**
 * Which app features a participant is enrolled for.
 *
 * Set when the record is created (see ParticipantForm) and editable here
 * afterwards — a family's eligibility can genuinely change mid-study, and a
 * coordinator should not have to re-create the account to change it.
 */
export function ParticipantFeaturesControl({
  participantId,
  enabledFeatures,
}: {
  participantId: string;
  enabledFeatures: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<ParticipantFeatureKey[]>(
    enabledFeatures.filter((key): key is ParticipantFeatureKey =>
      (ALL_PARTICIPANT_FEATURES as string[]).includes(key),
    ),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const dirty =
    selected.length !== enabledFeatures.length ||
    selected.some((key) => !enabledFeatures.includes(key));

  function toggle(feature: ParticipantFeatureKey, on: boolean) {
    setSaved(false);
    setSelected((prev) => (on ? [...prev, feature] : prev.filter((key) => key !== feature)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { enabledFeatures: selected } }),
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
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden="true" />
        <h2 className="text-ink text-xs font-medium">Which features this family can use</h2>
      </div>
      <div className="space-y-1.5">
        {ALL_PARTICIPANT_FEATURES.map((feature) => (
          <label key={feature} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="accent-primary size-3.5"
              checked={selected.includes(feature)}
              onChange={(event) => toggle(feature, event.target.checked)}
            />
            {PARTICIPANT_FEATURE_LABELS[feature]}
          </label>
        ))}
      </div>

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
        <Button size="sm" variant="primary" className="mt-2.5" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      ) : saved ? (
        <p className="text-success mt-2.5 text-xs">Saved.</p>
      ) : null}
    </Card>
  );
}
