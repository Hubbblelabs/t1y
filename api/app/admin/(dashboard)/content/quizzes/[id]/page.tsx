import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { QuizForm, type QuestionValue } from "@/components/admin/content/quiz-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { getQuizById } from "@/lib/services/quizzes";

export const metadata: Metadata = { title: "Edit quiz" };

/**
 * Editing one language of one quiz.
 *
 * Reached from the quiz list's language chips, which is also where the
 * second language is started from — the two versions are paired by a shared
 * slug the admin never sees or types.
 */
export default async function EditQuizPage(props: PageProps<"/admin/content/quizzes/[id]">) {
  const params = await props.params;

  const quiz = await getQuizById(params.id).catch(() => null);
  if (!quiz) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={quiz.title}
        description={`${quiz.locale === "EN" ? "English" : "Tamil"} version`}
        breadcrumbs={[
          { label: "What families see" },
          { label: "Quizzes", href: "/admin/content/quizzes" },
          { label: "Edit" },
        ]}
        actions={
          <DeleteButton
            resourceLabel="quiz"
            deleteUrl={`/api/admin/quizzes/${quiz.id}`}
            redirectTo="/admin/content/quizzes"
          />
        }
      />
      <QuizForm
        mode="edit"
        initial={{
          id: quiz.id,
          slug: quiz.slug,
          locale: quiz.locale,
          title: quiz.title,
          description: quiz.description ?? "",
          passingScore: quiz.passingScore == null ? "" : String(quiz.passingScore),
          status: quiz.status,
          questions: quiz.questions.map(toQuestionValue),
        }}
      />
    </PageContainer>
  );
}

function toQuestionValue(
  question: Awaited<ReturnType<typeof getQuizById>>["questions"][number],
  index: number,
): QuestionValue {
  return {
    key: `existing-${index}`,
    questionKey: question.questionKey,
    prompt: question.prompt,
    explanation: question.explanation ?? "",
    points: question.points,
    type: question.type,
    options: question.options.map((option) => ({
      text: option.text,
      matchText: option.matchText ?? "",
      isCorrect: option.isCorrect,
    })),
  };
}
