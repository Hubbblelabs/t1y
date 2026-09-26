"use client";

import * as React from "react";

import { CAPABILITY_GROUPS } from "@/lib/permissions/capability-groups";
import type { CapabilityValue } from "@/lib/permissions/roles";

/**
 * "Full access" vs "limited to these sections" — the picker behind both
 * adding a staff account and editing an existing one's access.
 *
 * `capabilities` is the raw list this account is restricted to; empty means
 * full access (see AdminUser.capabilities). Mode is tracked separately from
 * that list — switching to "Limited" with nothing checked yet must not look
 * like "Full access" (an empty list) while the person is still choosing.
 */
export function CapabilityGroupPicker({
  capabilities,
  onChange,
  disabled,
}: {
  capabilities: CapabilityValue[];
  onChange: (capabilities: CapabilityValue[]) => void;
  disabled?: boolean;
}) {
  const [limited, setLimitedState] = React.useState(capabilities.length > 0);
  const held = new Set(capabilities);

  function setLimited(next: boolean) {
    setLimitedState(next);
    if (!next) onChange([]);
  }

  function toggleGroup(groupCapabilities: CapabilityValue[], checked: boolean) {
    const next = new Set(capabilities);
    for (const capability of groupCapabilities) {
      if (checked) next.add(capability);
      else next.delete(capability);
    }
    onChange([...next]);
  }

  return (
    <fieldset className="border-line rounded-md border p-3">
      <legend className="text-ink px-1 text-sm font-medium">Access</legend>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="access-mode"
            checked={!limited}
            onChange={() => setLimited(false)}
            disabled={disabled}
          />
          <span>Full access to everything</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="access-mode"
            checked={limited}
            onChange={() => setLimited(true)}
            disabled={disabled}
          />
          <span>Limited to specific sections</span>
        </label>
      </div>

      {limited ? (
        <>
          <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
            {CAPABILITY_GROUPS.map((group) => (
              <label key={group.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={group.capabilities.every((c) => held.has(c))}
                  onChange={(event) => toggleGroup(group.capabilities, event.target.checked)}
                  disabled={disabled}
                />
                <span className="text-ink-muted">{group.label}</span>
              </label>
            ))}
          </div>
          {capabilities.length === 0 ? (
            <p className="text-warning mt-2 text-xs">Choose at least one section.</p>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
