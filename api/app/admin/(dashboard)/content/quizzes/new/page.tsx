import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { QuizForm } from "@/components/admin/content/quiz-form";

export const metadata: Metadata = { title: "New quiz" };

export default function NewQuizPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New quiz"
        description="Author a new quiz. It's saved as a draft until published."
        breadcrumbs={[
          { label: "Content" },
          { label: "Quizzes", href: "/admin/content/quizzes" },
          { label: "New" },
        ]}
      />
      <QuizForm mode="create" />
    </PageContainer>
  );
}
