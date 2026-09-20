import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ReplyBox } from "@/components/admin/support/reply-box";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupportThread, markSupportMessagesRead } from "@/lib/services/support";

export const metadata: Metadata = { title: "Help request" };

const STATUS = {
  AWAITING_REPLY: { label: "Waiting for an answer", tone: "warning" },
  ANSWERED: { label: "Answered", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
} as const;

/**
 * One conversation.
 *
 * Opening it marks the family's messages read — reading a thread is the act
 * of reading it, so there is nothing extra to press.
 */
export default async function SupportThreadPage(props: PageProps<"/admin/support/[id]">) {
  const params = await props.params;

  const thread = await getSupportThread(params.id).catch(() => null);
  if (!thread) notFound();

  await markSupportMessagesRead({ threadId: thread.id, readerRole: "ADMIN" });

  const status = STATUS[thread.status];

  return (
    <PageContainer>
      <PageHeader
        title={thread.subject}
        description={`About ${thread.user.name}${
          thread.user.profile?.participantCode ? ` · ${thread.user.profile.participantCode}` : ""
        }`}
        breadcrumbs={[
          { label: "Help requests", href: "/admin/support" },
          { label: thread.subject },
        ]}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <Card className="mb-4 p-4">
        <ol className="space-y-3">
          {thread.messages.map((message) => {
            const fromStaff = message.authorRole === "ADMIN";
            return (
              <li
                key={message.id}
                className={`rounded-md p-3 ${
                  fromStaff ? "bg-primary-soft ml-8" : "bg-surface-sunken mr-8"
                }`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-ink text-sm font-medium">
                    {fromStaff ? message.author.name : "The family"}
                  </span>
                  <time className="text-ink-subtle text-xs" dateTime={message.createdAt.toISOString()}>
                    {message.createdAt.toLocaleString("en-GB")}
                  </time>
                </div>

                <p className="text-ink whitespace-pre-wrap text-sm">{message.body}</p>

                {fromStaff && message.readAt ? (
                  <p className="text-ink-subtle mt-1 text-xs">Read by the family</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-4">
        <ReplyBox threadId={thread.id} closed={thread.status === "CLOSED"} />
      </Card>
    </PageContainer>
  );
}
