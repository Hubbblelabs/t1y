"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";

/**
 * Answering a family's question.
 *
 * Sending is what marks the thread answered — there is no separate status to
 * remember to change, so the inbox can never disagree with the conversation.
 */
export function ReplyBox({ threadId, closed }: { threadId: string; closed: boolean }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error?.message ?? "Your answer could not be sent.");
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setError("Your answer could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: "CLOSED" | "AWAITING_REPLY") {
    setSending(true);
    try {
      await fetch(`/api/admin/support/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger rounded-md px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}

      <Field label="Your answer" htmlFor="reply-body">
        <Textarea
          id="reply-body"
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your answer to the family…"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={send} disabled={sending || !body.trim()}>
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Send answer
        </Button>

        {closed ? (
          <Button variant="secondary" onClick={() => setStatus("AWAITING_REPLY")} disabled={sending}>
            Reopen
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setStatus("CLOSED")} disabled={sending}>
            Mark as closed
          </Button>
        )}
      </div>
    </div>
  );
}
