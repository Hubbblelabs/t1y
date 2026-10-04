"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export interface ChildOption {
  id: string;
  code: string;
  name: string;
}

export interface SosContactValues {
  name: string;
  phone: string;
  label: string;
  visibleToAll: boolean;
  active: boolean;
  participantIds: string[];
}

const EMPTY: SosContactValues = {
  name: "",
  phone: "",
  label: "",
  visibleToAll: false,
  active: true,
  participantIds: [],
};

/**
 * Adds or edits one SOS contact: who it is, the number, a free-text tag, and
 * which children's apps show it (everyone, or a chosen list).
 */
export function SosContactForm({
  contactId,
  initial,
  childOptions,
  existingTags,
}: {
  contactId?: string;
  initial?: SosContactValues;
  childOptions: ChildOption[];
  existingTags: string[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<SosContactValues>(initial ?? EMPTY);
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = React.useMemo(() => new Set(values.participantIds), [values.participantIds]);
  const shown = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? childOptions.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : childOptions;
  }, [childOptions, search]);

  function set<K extends keyof SosContactValues>(key: K, value: SosContactValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    set("participantIds", [...next]);
  }

  function selectShown(on: boolean) {
    const next = new Set(selected);
    for (const c of shown) {
      if (on) next.add(c.id);
      else next.delete(c.id);
    }
    set("participantIds", [...next]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(contactId ? `/api/admin/sos-contacts/${contactId}` : "/api/admin/sos-contacts", {
        method: contactId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.issues?.[0]?.message ?? body?.error?.message ?? "Could not save this contact.");
        return;
      }
      router.push("/admin/content/sos");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="sos-name">Name</Label>
          <Input id="sos-name" value={values.name} maxLength={80} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sos-phone">Phone number</Label>
            <Input
              id="sos-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={values.phone}
              maxLength={20}
              onChange={(e) => set("phone", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sos-label">Tag</Label>
            <Input
              id="sos-label"
              list="sos-tags"
              placeholder="Doctor, Nurse, Ambulance…"
              value={values.label}
              maxLength={40}
              onChange={(e) => set("label", e.target.value)}
              required
            />
            <datalist id="sos-tags">
              {existingTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-primary size-3.5" checked={values.active} onChange={(e) => set("active", e.target.checked)} />
          Show this contact in the app
        </label>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-ink text-sm font-medium">Who sees this contact</h2>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-primary size-3.5" checked={values.visibleToAll} onChange={(e) => set("visibleToAll", e.target.checked)} />
          Every child
        </label>

        {!values.visibleToAll ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search children"
                placeholder="Search by name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => selectShown(true)}>
                Select shown
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => selectShown(false)}>
                Clear shown
              </Button>
              <span className="text-ink-muted ml-auto text-xs">{selected.size} selected</span>
            </div>
            <ul className="border-line divide-line max-h-72 divide-y overflow-y-auto rounded-md border">
              {shown.length === 0 ? (
                <li className="text-ink-muted px-3 py-3 text-xs">No children match.</li>
              ) : (
                shown.map((child) => (
                  <li key={child.id}>
                    <label className="hover:bg-surface-hover flex items-center gap-2 px-3 py-2 text-xs">
                      <input type="checkbox" className="accent-primary size-3.5" checked={selected.has(child.id)} onChange={(e) => toggle(child.id, e.target.checked)} />
                      <span className="font-medium">{child.code}</span>
                      <span className="text-ink-muted truncate">{child.name}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </Card>

      {error ? (
        <div role="alert" className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-2.5 text-xs">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {contactId ? "Save changes" : "Add contact"}
        </Button>
        {contactId ? (
          <DeleteButton resourceLabel="SOS contact" deleteUrl={`/api/admin/sos-contacts/${contactId}`} redirectTo="/admin/content/sos" />
        ) : null}
      </div>
    </form>
  );
}
