import type { Metadata } from "next";
import { HelpCircle } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { formatDate, humaniseEnum } from "@/lib/utils/format";
import { listQuizzesForAdmin, getQuizStats } from "@/lib/services/quizzes";
import { StatCard } from "@/components/admin/stat-card";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Quizzes" };

/**
 * Read-only for now — quizzes are authored via `npm run content:seed-quizzes`
 * (see scripts/seed-quizzes.ts) transcribed by hand from the source
 * curriculum documents, or directly against POST/PATCH /api/admin/quizzes.
 * A full question-builder UI (comparable to the education Markdown editor)
 * is the natural next step once more quiz content needs authoring.
 */
export default async function QuizzesPage() {
  const [{ items }, stats] = await Promise.all([
    listQuizzesForAdmin({ skip: 0, take: 100 }),
    getQuizStats(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Quizzes"
        description="Topic quizzes shown to participants. Publish a quiz once its answer key has been reviewed."
        breadcrumbs={[{ label: "Content" }, { label: "Quizzes" }]}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total quizzes" value={formatNumber(stats.total)} />
        <StatCard label="Published" value={formatNumber(stats.published)} />
        <StatCard label="Drafts" value={formatNumber(stats.draft)} />
        <StatCard label="Archived" value={formatNumber(stats.archived)} />
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No quizzes yet"
            description="Run `npm run content:seed-quizzes` for a starter set, or create one via POST /api/admin/quizzes."
          />
        ) : (
          <TableScroll label="Quizzes">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell className="max-w-72">
                      <span className="text-ink block truncate font-medium">{quiz.title}</span>
                      <span className="text-ink-subtle block truncate text-xs">/{quiz.slug}</span>
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral">{quiz.locale}</Badge>
                    </TableCell>
                    <TableCell className="text-ink-muted">{quiz.topicSlug ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          quiz.status === "PUBLISHED"
                            ? "success"
                            : quiz.status === "DRAFT"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {humaniseEnum(quiz.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">{quiz._count.attempts}</TableCell>
                    <TableCell className="text-ink-muted whitespace-nowrap">
                      {formatDate(quiz.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </Card>
    </PageContainer>
  );
}
