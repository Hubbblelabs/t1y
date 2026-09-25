import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ParticipantForm } from "@/components/admin/participants/participant-form";

export const metadata: Metadata = { title: "Enrol participant" };

export default function NewParticipantPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Enrol participant"
        description="Add a child to the study and issue their family a temporary password."
        breadcrumbs={[{ label: "Participants", href: "/admin/participants" }, { label: "Enrol" }]}
      />
      <ParticipantForm />
    </PageContainer>
  );
}
