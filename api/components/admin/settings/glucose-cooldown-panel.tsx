"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * The whole "let a parent log glucose readings" feature, on one card: the
 * on/off switch and the cooldown-hours number that only matters once it's
 * on.
 *
 * The switch here is the same `health_logging_enabled` flag as Settings →
 * Feature flags — this is not a second source of truth, just a second place
 * to reach the one that already exists, put where an admin configuring
 * glucose entry would actually look for it rather than a separate page
 * about flags in general. See lib/services/feature-flags.ts for why the
 * flag defaults off: this study's ethics approval covers an education app,
 * not health-data collection.
 */
export function GlucoseCooldownPanel({
  initialEnabled,
  initialCooldownHours,
}: {
  initialEnabled: boolean;
  initialCooldownHours: number;
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [confirming, setConfirming] = React.useState(false);
  const [togglingFlag, setTogglingFlag] = React.useState(false);
  const [flagError, setFlagError] = React.useState<string | null>(null);

  const [value, setValue] = React.useState(String(initialCooldownHours));
  const [saved, setSaved] = React.useState(initialCooldownHours);
  const [saving, setSaving] = React.useState(false);
  const [cooldownError, setCooldownError] = React.useState<string | null>(null);

  const parsed = Number(value);
  const isValid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 1 && parsed <= 72;
  const dirty = isValid && parsed !== saved;

  async function setFlag(nextEnabled: boolean, acknowledgeClinicalSafety: boolean) {
    setTogglingFlag(true);
    setFlagError(null);

    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: { health_logging_enabled: nextEnabled },
          acknowledgeClinicalSafety,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setFlagError(body?.error?.message ?? "Could not update this setting.");
        return;
      }

      setEnabled(nextEnabled);
    } catch {
      setFlagError("Could not update this setting. Check your connection and try again.");
    } finally {
      setTogglingFlag(false);
    }
  }

  function onToggle(next: boolean) {
    // Turning it on gates clinical/health data collection — the same
    // confirmation Settings → Feature flags asks for, not a lighter path
    // just because it's reached from a different page.
    if (next) {
      setConfirming(true);
      return;
    }
    setFlag(false, false);
  }

  async function saveCooldown() {
    if (!isValid) return;
    setSaving(true);
    setCooldownError(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "health.glucoseEntryCooldownHours": parsed }),
      });
      const body = await response.json();

      if (!response.ok) {
        setCooldownError(body?.error?.message ?? "Could not save the cooldown.");
        return;
      }

      setSaved(parsed);
    } catch {
      setCooldownError("Could not save the cooldown. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-ink text-[13px] font-medium">Enable glucose entry</span>
            <Badge tone="warning">Clinical safety</Badge>
          </div>
          <p className="text-ink-subtle max-w-md text-xs">
            Lets a parent record glucometer readings in the app. Off by default — this study&apos;s
            ethics approval covers an education app, not health-data collection. Confirm
            ethics-committee sign-off before enabling.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={togglingFlag}
          aria-label="Enable glucose entry"
        />
      </div>
      {flagError && (
        <p role="alert" className="text-danger text-xs">
          {flagError}
        </p>
      )}

      {confirming && (
        <div className="border-warning/30 bg-warning-soft flex flex-col gap-3 rounded-md border p-3">
          <p className="text-ink text-xs leading-relaxed">
            This turns on collecting glucose readings from participating children. Confirm the
            study&apos;s ethics committee has signed off on this before enabling it.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={togglingFlag}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await setFlag(true, true);
                setConfirming(false);
              }}
              disabled={togglingFlag}
            >
              {togglingFlag ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm & enable"}
            </Button>
          </div>
        </div>
      )}

      <div className="border-line border-t pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="glucose-cooldown-hours"
              className="text-ink text-[13px] font-medium"
            >
              Hours between glucose entries
            </label>
            <p className="text-ink-subtle max-w-md text-xs">
              How long a parent must wait after recording a reading before the app lets them
              record another. Applies per child.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="glucose-cooldown-hours"
              type="number"
              min={1}
              max={72}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24"
            />
            <span className="text-ink-subtle text-[13px]">hours</span>
            <Button size="sm" onClick={saveCooldown} disabled={!dirty || saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
        {!isValid && value.trim() !== "" && (
          <p className="text-danger mt-2 text-xs">Enter a whole number of hours, 1 to 72.</p>
        )}
        {cooldownError && (
          <p role="alert" className="text-danger mt-2 text-xs">
            {cooldownError}
          </p>
        )}
        {!cooldownError && !dirty && saved !== initialCooldownHours && (
          <p className="text-success mt-2 text-xs">Saved.</p>
        )}
      </div>
    </Card>
  );
}
