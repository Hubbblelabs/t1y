"use client";

import * as React from "react";

import {
  GLUCOSE_SLOT_KEYS,
  GLUCOSE_SLOT_LABELS,
  MAX_REMINDER_HOURS,
  type GlucoseSlotKey,
  type HealthDataConfig,
} from "@/lib/health-data-config";

const HOUR_CHOICES = Array.from({ length: MAX_REMINDER_HOURS }, (_, i) => i + 1);

function hoursLabel(hours: number): string {
  if (hours === 24) return "Every 24 hours (once a day)";
  if (hours === 12) return "Every 12 hours (twice a day)";
  return `Every ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * The health-data configuration form — which glucose checks, how often
 * insulin, whether exercise — shared by the single-participant card and the
 * bulk editor so both ask exactly the same thing.
 */
export function HealthConfigEditor({
  value,
  onChange,
  disabled,
}: {
  value: HealthDataConfig;
  onChange: (next: HealthDataConfig) => void;
  disabled?: boolean;
}) {
  function toggleSlot(slot: GlucoseSlotKey, on: boolean) {
    const next = on ? [...value.glucoseSlots, slot] : value.glucoseSlots.filter((s) => s !== slot);
    onChange({ ...value, glucoseSlots: GLUCOSE_SLOT_KEYS.filter((s) => next.includes(s)) });
  }

  return (
    <div className="space-y-4 text-xs">
      <fieldset disabled={disabled}>
        <legend className="text-ink mb-1.5 font-medium">Glucose readings to collect</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {GLUCOSE_SLOT_KEYS.map((slot) => (
            <label key={slot} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary size-3.5"
                checked={value.glucoseSlots.includes(slot)}
                onChange={(e) => toggleSlot(slot, e.target.checked)}
              />
              {GLUCOSE_SLOT_LABELS[slot]}
            </label>
          ))}
        </div>
        {value.glucoseSlots.length === 0 ? (
          <p className="text-ink-muted mt-1.5">No glucose readings will be asked for.</p>
        ) : null}
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="text-ink mb-1.5 font-medium">Insulin</legend>
        <select
          className="border-line bg-surface w-full rounded-md border px-2 py-1.5"
          aria-label="Insulin reminder interval"
          value={value.insulinIntervalHours ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              insulinIntervalHours: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">No insulin reminder</option>
          {HOUR_CHOICES.map((h) => (
            <option key={h} value={h}>
              {hoursLabel(h)}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="text-ink mb-1.5 font-medium">Exercise</legend>
        <label className="mb-1.5 flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={value.exerciseEnabled}
            onChange={(e) =>
              onChange({
                ...value,
                exerciseEnabled: e.target.checked,
                exerciseReminderHours: e.target.checked ? value.exerciseReminderHours : null,
              })
            }
          />
          Ask this family to record exercise
        </label>
        {value.exerciseEnabled ? (
          <select
            className="border-line bg-surface w-full rounded-md border px-2 py-1.5"
            aria-label="Exercise reminder interval"
            value={value.exerciseReminderHours ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                exerciseReminderHours: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">No exercise reminder</option>
            {HOUR_CHOICES.map((h) => (
              <option key={h} value={h}>
                {hoursLabel(h)}
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>
    </div>
  );
}
