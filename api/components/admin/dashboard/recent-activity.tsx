import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatRelative } from "@/lib/utils/format";
import type { ActivityEntry } from "@/lib/services/analytics";

/**
 * Recent participant activity across the visible cohort — sign-ups, Help
 * Book topics finished, and quiz attempts (see
 * lib/services/analytics.ts#getRecentActivity for why it's sourced from
 * these rather than the generic health-logging models).
 *
 * Shows the participant code rather than their name: the dashboard's overview
 * surfaces do not need to identify people, and the code is enough to navigate.
 */
export function RecentActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 px-0 pb-0">
        {entries.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Sign-ups, topics read, and quiz attempts will appear here as they happen."
            className="py-10"
          />
        ) : (
          <ul className="divide-line divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-[13px]">
                    <span className="font-medium">{entry.kind}</span>
                    <span className="text-ink-muted"> · {entry.summary}</span>
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {entry.participantCode} · {formatRelative(entry.occurredAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Vertical timeline used on the participant detail page.
 *
 * Grouped by day, with the date shown once per group — the layout the
 * requirements sketch out.
 */
export function Timeline({
  entries,
}: {
  entries: Array<{
    id: string;
    occurredAt: Date | string;
    summary: string;
    detail?: string;
  }>;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activity in this period"
        description="This participant has not logged anything within the selected date range."
      />
    );
  }

  const groups = groupByDay(entries);

  return (
    <ol className="relative space-y-6">
      {groups.map((group) => (
        <li key={group.key}>
          <p className="text-ink-subtle mb-2 text-xs font-medium tracking-wide uppercase">
            {group.label}
          </p>
          <ul className="border-line space-y-3 border-l pl-4">
            {group.entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden="true"
                  className="bg-line-strong absolute top-1.5 -left-[1.3rem] size-1.5 rounded-full"
                />
                <p className="text-ink text-[13px] font-medium">{entry.summary}</p>
                {entry.detail ? (
                  <p className="text-ink-muted mt-0.5 text-[13px]">{entry.detail}</p>
                ) : null}
                <p className="text-ink-subtle mt-0.5 text-xs">
                  {new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(entry.occurredAt))}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay<T extends { occurredAt: Date | string }>(entries: T[]) {
  const groups = new Map<string, { key: string; label: string; entries: T[] }>();

  for (const entry of entries) {
    const date = new Date(entry.occurredAt);
    const key = date.toISOString().slice(0, 10);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(date),
        entries: [],
      });
    }
    groups.get(key)!.entries.push(entry);
  }

  return [...groups.values()];
}
