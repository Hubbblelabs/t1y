"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export interface FlagRow {
  key: string;
  enabled: boolean;
  description: string;
  clinicalSafety: boolean;
  safetyNotice?: string;
  updatedAt: string | null;
}

/**
 * Toggles a flag. Clinical-safety flags require an explicit acknowledgement
 * dialog before enabling — see lib/services/feature-flags.ts for why: a
 * cached `true` on a device can outlive an admin turning it back off, so
 * enabling one is a decision worth pausing on, not a casual switch flip.
 */
export function FeatureFlagsPanel({ initial }: { initial: FlagRow[] }) {
  const [flags, setFlags] = React.useState(initial);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(key: string, nextEnabled: boolean) {
    const flag = flags.find((f) => f.key === key);
    if (!flag) return;

    if (flag.clinicalSafety && nextEnabled) {
      const confirmed = confirm(
        `"${key}" gates clinical content.\n\n${flag.safetyNotice ?? ""}\n\nEnable it?`,
      );
      if (!confirmed) return;
    }

    setPendingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: { [key]: nextEnabled },
          acknowledgeClinicalSafety: flag.clinicalSafety && nextEnabled,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? `Could not update "${key}".`);
        return;
      }

      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: nextEnabled } : f)));
    } catch {
      setError(`Could not update "${key}". Check your connection and try again.`);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-[13px]">
          {error}
        </div>
      ) : null}

      {flags.map((flag) => (
        <Card key={flag.key} className="flex items-start justify-between gap-4 p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-ink font-mono text-sm font-medium">{flag.key}</span>
              {flag.clinicalSafety ? (
                <Badge tone="warning">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Clinical safety
                </Badge>
              ) : null}
            </div>
            <p className="text-ink-muted text-[13px]">{flag.description}</p>
            {flag.safetyNotice ? (
              <p className="text-warning text-xs">{flag.safetyNotice}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {pendingKey === flag.key ? (
              <Loader2 className="text-ink-subtle size-4 animate-spin" aria-hidden="true" />
            ) : null}
            <Switch
              checked={flag.enabled}
              disabled={pendingKey !== null}
              onCheckedChange={(checked) => toggle(flag.key, checked)}
              aria-label={`Toggle ${flag.key}`}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
