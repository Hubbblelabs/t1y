import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listQuizGroups, type QuizGroup } from "@/lib/services/quizzes";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Quizzes" };

const LANGUAGE_NAME = { EN: "English", TA: "Tamil" } as const;
type Language = keyof typeof LANGUAGE_NAME;

const STATUS_LABEL = {
  PUBLISHED: "Live",
  DRAFT: "Not finished",
  ARCHIVED: "Hidden",
} as const;

/**
 * The quiz library, one row per quiz rather than one per stored row.
 *
 * A quiz exists in English and Tamil; showing those as two entries made the
 * list look twice as long as it is and hid the thing that actually matters —
 * which quizzes a family reading in Tamil cannot take yet.
 */
export default async function QuizzesPage() {
  const quizzes = await listQuizGroups();

  const live = quizzes.filter(
    (quiz) => quiz.versions.EN?.status === "PUBLISHED" || quiz.versions.TA?.status === "PUBLISHED",
  ).length;
  const missingTamil = quizzes.filter((quiz) => !quiz.versions.TA).length;

  return (
    <PageContainer>
      <PageHeader
        title="Quizzes"
        description="The questions families answer after reading a topic"
        breadcrumbs={[{ label: "What families see" }, { label: "Quizzes" }]}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/content/quizzes/new">
              <Plus className="size-4" aria-hidden="true" />
              New quiz
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Quizzes" value={formatNumber(quizzes.length)} />
        <StatCard label="Live in the app" value={formatNumber(live)} />
        <StatCard label="Still need Tamil" value={formatNumber(missingTamil)} />
      </div>

      <Card>
        {quizzes.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No quizzes yet"
            description="Add a quiz so families can check what they have understood."
          />
        ) : (
          <ul className="divide-line divide-y">
            {quizzes.map((quiz) => (
              <li key={quiz.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate font-medium">{quiz.displayTitle}</p>
                  <p className="text-ink-subtle truncate text-xs">
                    {questionSummary(quiz)}
                    {quiz.topicSlug ? " · attached to a Help Book topic" : " · not attached to a topic"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {(["EN", "TA"] as Language[]).map((language) => (
                    <LanguageChip key={language} quiz={quiz} language={language} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}

/**
 * One language's state: a link to edit it, or an invitation to write it.
 *
 * A missing translation gets a button rather than a blank space — it is the
 * thing most worth acting on, so it should look like something to do.
 */
function LanguageChip({ quiz, language }: { quiz: QuizGroup; language: Language }) {
  const version = quiz.versions[language];

  if (!version) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/content/quizzes/new?quiz=${quiz.slug}&language=${language}`}>
          <Plus className="size-4" aria-hidden="true" />
          Add {LANGUAGE_NAME[language]}
        </Link>
      </Button>
    );
  }

  return (
    <Link
      href={`/admin/content/quizzes/${version.id}`}
      className="border-line hover:bg-surface-hover flex items-center gap-2 rounded-md border px-2.5 py-1.5"
      title={`Edit the ${LANGUAGE_NAME[language]} version`}
    >
      <span className="text-ink text-xs font-medium">{LANGUAGE_NAME[language]}</span>
      <Badge
        tone={
          version.status === "PUBLISHED"
            ? "success"
            : version.status === "DRAFT"
              ? "warning"
              : "neutral"
        }
      >
        {STATUS_LABEL[version.status]}
      </Badge>
    </Link>
  );
}

function questionSummary(quiz: QuizGroup): string {
  const counts = [quiz.versions.EN?.questionCount, quiz.versions.TA?.questionCount].filter(
    (count): count is number => count != null,
  );
  if (counts.length === 0) return "No questions yet";
  const most = Math.max(...counts);
  return `${most} question${most === 1 ? "" : "s"}`;
}
