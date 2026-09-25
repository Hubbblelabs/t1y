import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listGlucoseLoggingStatus, GLUCOSE_REMINDER_GAP_HOURS } from "@/lib/services/glucose-reminders";
import { formatRelative } from "@/lib/utils/format";

/**
 * Who is behind on glucose logging, right now.
 *
 * The phone-side reminder (see lib/services/glucose-reminders.ts and
 * /api/cron/glucose-reminders) nudges a family after
 * {@link GLUCOSE_REMINDER_GAP_HOURS} hours of silence; this is the matching
 * view for staff, so a gap is visible here whether or not the family has
 * acted on their own notification yet.
 */
export async function GlucoseLoggingStatus() {
  const statuses = await listGlucoseLoggingStatus();
  const overdue = statuses.filter((status) => status.overdue);

  if (statuses.length === 0) return null;

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-ink text-sm font-semibold">Glucose logging</h2>
          <p className="text-ink-muted text-xs">
            {overdue.length === 0
              ? `Everyone eligible has logged within the last ${GLUCOSE_REMINDER_GAP_HOURS} hours.`
              : `${overdue.length} of ${statuses.length} eligible ${statuses.length === 1 ? "child hasn't" : "children haven't"} logged in the last ${GLUCOSE_REMINDER_GAP_HOURS} hours.`}
          </p>
        </div>
      </div>

      {overdue.length > 0 ? (
        <ul className="divide-line divide-y">
          {overdue.slice(0, 8).map((status) => (
            <li key={status.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <Link href={`/admin/participants/${status.userId}`} className="text-ink hover:underline">
                {status.name}
                {status.participantCode ? (
                  <span className="text-ink-subtle"> · {status.participantCode}</span>
                ) : null}
              </Link>
              <Badge tone="warning">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {status.lastReadingAt ? `Last ${formatRelative(status.lastReadingAt)}` : "No reading yet"}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {overdue.length > 8 ? (
        <p className="text-ink-subtle mt-2 text-xs">and {overdue.length - 8} more.</p>
      ) : null}
    </Card>
  );
}
