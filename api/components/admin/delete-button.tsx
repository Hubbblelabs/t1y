"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Confirm-then-delete. A native `confirm()` is enough for a low-frequency admin action. */
export function DeleteButton({
  resourceLabel,
  deleteUrl,
  redirectTo,
}: {
  resourceLabel: string;
  deleteUrl: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (!confirm(`Delete this ${resourceLabel}? This cannot be undone.`)) return;

    setPending(true);
    try {
      const response = await fetch(deleteUrl, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        alert(body?.error?.message ?? `Could not delete this ${resourceLabel}.`);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="size-4" aria-hidden="true" />
      )}
      Delete
    </Button>
  );
}
