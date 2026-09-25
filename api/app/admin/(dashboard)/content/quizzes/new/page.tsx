import type { Metadata } from "next";

import { QuizForm } from "@/components/admin/content/quiz-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "New quiz" };

/**
 * Writing a quiz, or adding its second language.
 *
 * `quiz` and `language` are set by the "Add Tamil" / "Add English" buttons on
 * the quiz list. They carry the existing quiz's identity so the new version
 * pairs with it rather than becoming a separate quiz with a similar name.
 */
export default async function NewQuizPage(props: PageProps<"/admin/content/quizzes/new">) {
  const searchParams = await props.searchParams;

  const slug = typeof searchParams.quiz === "string" ? searchParams.quiz : undefined;
  const language: "EN" | "TA" | undefined =
    searchParams.language === "TA" ? "TA" : searchParams.language === "EN" ? "EN" : undefined;
  const addingLanguageTo = slug && language ? { slug, language } : undefined;

  return (
    <PageContainer>
      <PageHeader
        title={
          addingLanguageTo
            ? `Add the ${addingLanguageTo.language === "TA" ? "Tamil" : "English"} version`
            : "New quiz"
        }
        description={
          addingLanguageTo
            ? "Write this quiz in the second language. Nobody sees it until you set it live."
            : "Write a new quiz. Nobody sees it until you set it live."
        }
        breadcrumbs={[
          { label: "What families see" },
          { label: "Quizzes", href: "/admin/content/quizzes" },
          { label: addingLanguageTo ? "Add a language" : "New quiz" },
        ]}
      />
      <QuizForm mode="create" addingLanguageTo={addingLanguageTo} />
    </PageContainer>
  );
}
