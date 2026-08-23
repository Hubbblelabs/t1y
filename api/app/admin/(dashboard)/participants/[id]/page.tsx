import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ParticipantEngagement } from "@/components/admin/participants/participant-engagement";
import { ParticipantProfileCard } from "@/components/admin/participants/participant-profile";
import { ParticipantStatusControl } from "@/components/admin/participants/participant-status-control";
import { IcIsfUnlockControl } from "@/components/admin/participants/ic-isf-unlock-control";
import { ParticipantTimeline } from "@/components/admin/participants/participant-timeline";
import { StatusBadge } from "@/components/admin/participants/participant-table";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, StatSkeleton, UnauthorizedState } from "@/components/ui/states";
import {
  AuditAction,
  actorFromPrincipal,
  recordAudit,
  requestContextFrom,
} from "@/lib/audit/audit";
import { requirePrincipal } from "@/lib/auth/session";
import { can, canViewParticipant } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getParticipantProfile } from "@/lib/services/participants";
import { dateRangeSchema } from "@/lib/validation/common";
import { headers } from "next/headers";
import { NotFoundError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "Participant" };

/**
 * Participant detail.
 *
 * Authorisation is per-participant, not merely per-role: a researcher with
 * `PARTICIPANTS_VIEW` still cannot open someone outside their studies. Opening
 * the page writes an audit entry — viewing an individual's record is a
 * sensitive act in its own right.
 */
export default async function ParticipantDetailPage(
  props: PageProps<"/admin/participants/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();

  if (!(await canViewParticipant(principal, id))) {
    return (
      <PageContainer>
        <UnauthorizedState detail="You do not have access to this participant. Researchers can only view participants enrolled in their assigned studies." />
      </PageContainer>
    );
  }

  let participant: Awaited<ReturnType<typeof getParticipantProfile>>;
  try {
    participant = await getParticipantProfile(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // Recorded on the server, before anything renders.
  const requestHeaders = await headers();
  await recordAudit(
    actorFromPrincipal(principal),
    {
      action: AuditAction.PARTICIPANT_VIEWED,
      resourceType: "participant",
      resourceId: id,
      participantId: id,
      description: `Opened participant ${participant.profile?.participantCode ?? id}`,
    },
    requestContextFrom(new Request("http://internal", { headers: requestHeaders })),
  );

  const parsed = dateRangeSchema.safeParse(searchParams);
  const range = parsed.success ? parsed.data : { range: "30d" as const };

  const displayName = participant.profile
    ? `${participant.profile.firstName} ${participant.profile.lastName}`
    : participant.name;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Participants", href: "/admin/participants" },
          { label: participant.profile?.participantCode ?? id },
        ]}
        title={displayName}
        description={`${participant.profile?.participantCode ?? "No code"} · ${participant.email}`}
        actions={
          <>
            <StatusBadge status={participant.status} />
            <DateRangePicker />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
        <div className="space-y-6">
          {(participant.status === "PENDING" ||
            participant.status === "ACTIVE" ||
            participant.status === "INACTIVE") &&
          can(principal, Capability.PARTICIPANTS_EDIT) ? (
            <ParticipantStatusControl participantId={id} status={participant.status} />
          ) : null}

          {can(principal, Capability.PARTICIPANTS_EDIT) ? (
            <IcIsfUnlockControl
              participantId={id}
              unlocked={participant.profile?.icIsfUnlocked ?? false}
            />
          ) : null}

          <ParticipantProfileCard participant={participant} />

          <Card className="p-5">
            <h2 className="text-ink mb-3 text-sm font-semibold">Activity</h2>
            <Suspense fallback={<div className="text-ink-subtle text-xs">Loading…</div>}>
              <ParticipantTimeline userId={id} range={range} />
            </Suspense>
          </Card>
        </div>

        <div className="min-w-0">
          <Suspense fallback={<EngagementFallback />}>
            <ParticipantEngagement userId={id} />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  );
}

function EngagementFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <ChartSkeleton />
      </Card>
      <Card className="p-5">
        <ChartSkeleton height={220} />
      </Card>
    </div>
  );
}
