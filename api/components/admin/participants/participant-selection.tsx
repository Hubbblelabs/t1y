"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Settings2, X } from "lucide-react";

import { HealthConfigEditor } from "@/components/admin/participants/health-config-editor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DEFAULT_HEALTH_CONFIG,
  describeHealthConfig,
  type HealthDataConfig,
} from "@/lib/health-data-config";

/**
 * Row selection for the participant table, plus the bulk "Health data
 * configuration" editor that acts on whoever is selected.
 *
 * The table itself stays a server component; only the checkboxes and the bar
 * are client-side, sharing selection through this context.
 */
interface SelectionContext {
  selected: Set<string>;
  pageIds: string[];
  toggle: (id: string, on: boolean) => void;
  toggleAll: (on: boolean) => void;
  clear: () => void;
}

const Ctx = React.createContext<SelectionContext | null>(null);

function useSelection(): SelectionContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("Participant selection used outside its provider.");
  return ctx;
}

export function ParticipantSelectionProvider({
  pageIds,
  canEdit,
  children,
}: {
  pageIds: string[];
  canEdit: boolean;
  children: React.ReactNode;
}) {
  // Selection is remembered together with the page it was made on, so a
  // different page of results starts empty — a hidden selection must never
  // carry across pages into a bulk overwrite.
  const key = pageIds.join(",");
  const [state, setState] = React.useState<{ key: string; ids: Set<string> }>({
    key,
    ids: new Set(),
  });
  const selected = React.useMemo(
    () => (state.key === key ? state.ids : new Set<string>()),
    [state, key],
  );

  const value = React.useMemo<SelectionContext>(
    () => ({
      selected,
      pageIds,
      toggle: (id, on) => {
        const next = new Set(selected);
        if (on) next.add(id);
        else next.delete(id);
        setState({ key, ids: next });
      },
      toggleAll: (on) => setState({ key, ids: on ? new Set(pageIds) : new Set() }),
      clear: () => setState({ key, ids: new Set() }),
    }),
    [selected, pageIds, key],
  );

  return (
    <Ctx.Provider value={value}>
      {canEdit ? <BulkHealthConfigBar /> : null}
      {children}
    </Ctx.Provider>
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className="accent-primary size-3.5"
      aria-label={`Select ${label}`}
      checked={selected.has(id)}
      onChange={(e) => toggle(id, e.target.checked)}
    />
  );
}

export function SelectAllCheckbox() {
  const { selected, pageIds, toggleAll } = useSelection();
  const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      className="accent-primary size-3.5"
      aria-label="Select all participants on this page"
      checked={all}
      onChange={(e) => toggleAll(e.target.checked)}
    />
  );
}

function BulkHealthConfigBar() {
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"edit" | "review">("edit");
  const [config, setConfig] = React.useState<HealthDataConfig>(DEFAULT_HEALTH_CONFIG);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function begin() {
    setStep("edit");
    setError(null);
    setNotice(null);
    setOpen(true);
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/participants/health-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: [...selected], ...config }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not update these participants.");
        return;
      }
      const count: number = body?.data?.updated?.length ?? selected.size;
      setOpen(false);
      clear();
      setNotice(
        `Health data configuration updated for ${count} participant${count === 1 ? "" : "s"}. Their apps pick it up next time they open or refresh.`,
      );
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice ? (
        <div
          role="status"
          className="bg-success-soft text-success border-line flex items-start justify-between gap-2 border-b px-4 py-2.5 text-xs"
        >
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden="true" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="border-line flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-ink-muted text-xs">
          {selected.size === 0
            ? "Select participants to set what health data they are asked to record."
            : `${selected.size} selected`}
        </p>
        <Button size="sm" variant="secondary" disabled={selected.size === 0} onClick={begin}>
          <Settings2 className="size-4" aria-hidden="true" />
          Health data configuration
        </Button>
      </div>

      <Sheet open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <SheetContent
          side="right"
          title="Health data configuration"
          description="Choose what the selected participants are asked to record."
          className="w-[min(26rem,95vw)]"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <h2 className="text-ink text-sm font-medium">
              Health data configuration · {selected.size} participant{selected.size === 1 ? "" : "s"}
            </h2>

            {step === "edit" ? (
              <HealthConfigEditor value={config} onChange={setConfig} />
            ) : (
              <div className="space-y-3 text-xs">
                <p className="bg-warning-soft text-warning rounded-md p-2.5">
                  This replaces the existing health data settings of the {selected.size} selected
                  participant{selected.size === 1 ? "" : "s"}. Please check it before saving.
                </p>
                <ul className="border-line divide-line divide-y rounded-md border">
                  {describeHealthConfig(config).map((line) => (
                    <li key={line} className="px-3 py-2">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error ? (
              <div
                role="alert"
                className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-2.5 text-xs"
              >
                <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="border-line flex justify-end gap-2 border-t p-4">
            {step === "edit" ? (
              <Button size="sm" variant="primary" onClick={() => setStep("review")}>
                Review
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setStep("edit")} disabled={busy}>
                  Back
                </Button>
                <Button size="sm" variant="primary" onClick={apply} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Confirm and save
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
