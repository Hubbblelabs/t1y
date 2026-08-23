import type { Metadata } from "next";

import { BulkImportForm } from "@/components/admin/participants/bulk-import-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Bulk import participants" };

export default function BulkImportParticipantsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Bulk import participants"
        description="Enrol many children at once from a spreadsheet, all sharing one temporary password."
        breadcrumbs={[{ label: "Participants", href: "/admin/participants" }, { label: "Bulk import" }]}
      />
      <BulkImportForm />
    </PageContainer>
  );
}
