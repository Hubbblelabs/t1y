import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { countAwaitingReply, listSupportThreadsForAdmin } from "@/lib/services/support";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Help requests" };

/** Plain words for the three states a question can be in. */
const STATUS = {
  AWAITING_REPLY: { label: "Waiting for an answer", tone: "warning" },
  ANSWERED: { label: "Answered", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
} as const;

/**
 * The help inbox.
 *
 * Questions families have sent about their child. Unanswered ones sort to
 * the top because they are the only rows that need anyone to do anything.
 */
export default async function SupportPage() {
  const [threads, awaiting] = await Promise.all([
    listSupportThreadsForAdmin(),
    countAwaitingReply(),
  ]);

  const answered = threads.filter((thread) => thread.status === "ANSWERED").length;

  return (
    <PageContainer>
      <PageHeader
        title="Help requests"
        description="Questions families have sent from the app, and your answers"
        breadcrumbs={[{ label: "Help requests" }]}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Waiting for an answer" value={formatNumber(awaiting)} />
        <StatCard label="Answered" value={formatNumber(answered)} />
        <StatCard label="All questions" value={formatNumber(threads.length)} />
      </div>

      <Card>
        {threads.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No questions yet"
            description="When a family sends a question from the app, it will appear here."
          />
        ) : (
          <ul className="divide-line divide-y">
            {threads.map((thread) => {
              const status = STATUS[thread.status];
              const latest = thread.messages[0];
              return (
                <li key={thread.id}>
                  <Link
                    href={`/admin/support/${thread.id}`}
                    className="hover:bg-surface-hover flex flex-wrap items-start gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ink font-medium">{thread.subject}</span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        About {thread.user.name}
                        {thread.user.profile?.participantCode
                          ? ` · ${thread.user.profile.participantCode}`
                          : ""}
                        {" · "}
                        {thread._count.messages} message
                        {thread._count.messages === 1 ? "" : "s"}
                      </p>
                      {latest ? (
                        <p className="text-ink-muted mt-1 line-clamp-1 text-sm">
                          {latest.authorRole === "ADMIN" ? "You: " : ""}
                          {latest.body}
                        </p>
                      ) : null}
                    </div>
                    <time
                      className="text-ink-subtle shrink-0 text-xs"
                      dateTime={thread.lastMessageAt.toISOString()}
                    >
                      {thread.lastMessageAt.toLocaleDateString("en-GB")}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
