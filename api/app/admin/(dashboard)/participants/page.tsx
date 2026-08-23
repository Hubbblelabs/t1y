import type { Metadata } from "next";
import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ParticipantFilters } from "@/components/admin/participants/participant-filters";
import { ParticipantTable } from "@/components/admin/participants/participant-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
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
        // ADMIN is the only staff role now — always sees every participant.
        description="All participants registered on the platform"
        actions={
          can(principal, Capability.PARTICIPANTS_CREATE) ? (
            <div className="flex gap-2">
              <Button asChild variant="secondary">
                <Link href="/admin/participants/bulk">
                  <Upload className="size-4" aria-hidden="true" />
                  Bulk import
                </Link>
              </Button>
              <Button asChild>
                <Link href="/admin/participants/new">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Enrol participant
                </Link>
              </Button>
            </div>
          ) : undefined
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
