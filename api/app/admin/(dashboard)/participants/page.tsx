import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ParticipantFilters } from "@/components/admin/participants/participant-filters";
import { ParticipantTable } from "@/components/admin/participants/participant-table";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { participantListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Participants" };

/**
 * Participant directory.
 *
 * Filters and pagination live in the URL and the query runs on the server, so
 * only one page of rows ever reaches the browser regardless of cohort size.
 */
export default async function ParticipantsPage(
  props: PageProps<"/admin/participants">,
) {
  const principal = await requirePrincipal();
  const searchParams = await props.searchParams;

  const parsed = participantListQuerySchema.safeParse(searchParams);
  const query = parsed.success
    ? parsed.data
    : participantListQuerySchema.parse({});

  return (
    <PageContainer>
      <PageHeader
        title="Participants"
        description={
          principal.role === "RESEARCHER"
            ? "Participants enrolled in studies you have access to"
            : "All participants registered on the platform"
        }
      />

      <Card>
        <ParticipantFilters />

        <Suspense
          key={JSON.stringify(searchParams)}
          fallback={<TableSkeleton rows={10} columns={8} />}
        >
          <ParticipantTable principal={principal} query={query} />
        </Suspense>
      </Card>
    </PageContainer>
  );
}
