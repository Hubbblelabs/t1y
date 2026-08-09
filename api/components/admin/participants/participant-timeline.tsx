import { Timeline } from "@/components/admin/dashboard/recent-activity";
import { getParticipantTimeline } from "@/lib/services/participants";
import { resolveDateRange, type DateRangeInput } from "@/lib/validation/common";

/** Merged activity feed for the participant detail sidebar. */
export async function ParticipantTimeline({
  userId,
  range,
}: {
  userId: string;
  range: DateRangeInput;
}) {
  const { from, to } = resolveDateRange(range);
  const entries = await getParticipantTimeline({ userId, from, to, limit: 30 });

  return <Timeline entries={entries} />;
}
