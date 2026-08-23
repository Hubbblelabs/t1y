import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { ExerciseForm } from "@/components/admin/content/exercise-form";

export const metadata: Metadata = { title: "New exercise programme" };

export default function NewExerciseProgrammePage() {
  return (
    <PageContainer>
      <PageHeader
        title="New exercise programme"
        description="Add a guided exercise programme. It's saved as a draft until published."
        breadcrumbs={[
          { label: "Content" },
          { label: "Exercise programmes", href: "/admin/content/exercises" },
          { label: "New" },
        ]}
      />
      <ExerciseForm mode="create" />
    </PageContainer>
  );
}
