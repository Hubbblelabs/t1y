"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CAPABILITY_GROUPS } from "@/lib/permissions/capability-groups";
import type { CapabilityValue } from "@/lib/permissions/roles";
import { CapabilityGroupPicker } from "./capability-group-picker";

/**
 * What a staff account can do, and the editor for changing it — the "give
 * someone access to only the Help Book pages" case. Reuses the same picker
 * AddStaffForm uses when creating an account.
 */
export function StaffAccessControl({
  staffId,
  capabilities: initial,
}: {
  staffId: string;
  capabilities: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [capabilities, setCapabilities] = React.useState<CapabilityValue[]>(
    initial as CapabilityValue[],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const groupLabels = CAPABILITY_GROUPS.filter((group) =>
    group.capabilities.every((c) => initial.includes(c)),
  ).map((group) => group.label);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/admins/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not update access.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-ink-muted text-xs">
          {initial.length === 0 ? "Full access" : groupLabels.join(", ") || "No sections"}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Edit access">
          <Pencil className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-72">
      <CapabilityGroupPicker capabilities={capabilities} onChange={setCapabilities} disabled={saving} />
      {error ? <p className="text-danger mt-2 text-xs">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCapabilities(initial as CapabilityValue[]);
            setEditing(false);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
