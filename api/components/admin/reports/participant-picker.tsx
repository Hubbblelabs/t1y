"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface Participant {
  id: string;
  name: string;
  email: string;
  profile: { participantCode: string } | null;
}

/**
 * Switches the Reports page from the whole-cohort view to one child's own
 * numbers, via a `userId` query param — a server component reads the same
 * query string, same pattern as DateRangePicker.
 */
export function ReportParticipantPicker({
  selectedName,
}: {
  /** The currently-selected child's name, if `userId` is already in the URL. */
  selectedName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/admin/reports/participants?search=${encodeURIComponent(search)}`,
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
  }, [search, open]);

  function selectParticipant(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("userId", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
    setSearch("");
  }

  function clearSelection() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("userId");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (selectedName) {
    return (
      <button
        type="button"
        onClick={clearSelection}
        className="border-line bg-surface hover:bg-surface-hover text-ink flex h-10 items-center gap-2 rounded-md border px-3 text-sm"
      >
        <span className="font-medium">{selectedName}</span>
        <X className="text-ink-subtle size-3.5" aria-hidden="true" />
        <span className="text-ink-muted">Back to everyone</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="text-ink-subtle absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="w-64 pl-9"
          placeholder="Check one child's report"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open ? (
        <>
          {/* Click-away target, beneath the list. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="border-line bg-surface absolute top-full right-0 z-20 mt-1 max-h-72 w-80 space-y-0.5 overflow-y-auto rounded-md border p-1 shadow-lg">
            {searching ? (
              <li className="text-ink-subtle p-2 text-sm">Searching…</li>
            ) : participants.length === 0 ? (
              <li className="text-ink-subtle p-2 text-sm">
                {search ? "No one matches." : "Type a name, email, or child ID."}
              </li>
            ) : (
              participants.map((participant) => (
                <li key={participant.id}>
                  <button
                    type="button"
                    onClick={() => selectParticipant(participant.id)}
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
      ) : null}
    </div>
  );
}
