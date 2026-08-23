import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { EducationForm } from "@/components/admin/content/education-form";

export const metadata: Metadata = { title: "New article" };

export default function NewEducationPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New article"
        description="Author a new education topic. It's saved as a draft until published."
        breadcrumbs={[
          { label: "Content" },
          { label: "Education", href: "/admin/content/education" },
          { label: "New" },
        ]}
      />
      <EducationForm mode="create" />
    </PageContainer>
  );
}
