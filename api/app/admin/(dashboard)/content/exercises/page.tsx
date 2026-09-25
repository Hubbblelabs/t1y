import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { buildPagination } from "@/lib/api/response";
import { getProgramStats, listProgramsForAdmin } from "@/lib/services/exercise-content";
import { formatDate, formatDuration, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { programListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Exercise programmes" };

/** Guided exercise programmes offered in the mobile application. */
export default async function ExerciseContentPage(
  props: PageProps<"/admin/content/exercises">,
) {
  const searchParams = await props.searchParams;
  const parsed = programListQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : programListQuerySchema.parse({});

  const [{ items, total }, stats] = await Promise.all([
    listProgramsForAdmin({
      status: query.status,
      category: query.category,
      difficulty: query.difficulty,
      search: query.search,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    getProgramStats(),
  ]);

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Exercise programmes"
        description="Guided programmes with instructions and media"
        breadcrumbs={[{ label: "Content" }, { label: "Exercise programmes" }]}
        actions={
          <Button asChild>
            <Link href="/admin/content/exercises/new">
              <Plus className="size-4" aria-hidden="true" />
              New programme
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total programmes" value={formatNumber(stats.total)} />
        <StatCard label="Published" value={formatNumber(stats.published)} />
        <StatCard label="Drafts" value={formatNumber(stats.draft)} />
        <StatCard label="Archived" value={formatNumber(stats.archived)} />
      </div>

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by title" />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title={query.search ? "No programmes match your search" : "No programmes yet"}
            description={
              query.search
                ? "Try a different search term."
                : "Create a programme to offer guided exercise sessions to participants."
            }
          />
        ) : (
          <>
            <TableScroll label="Exercise programmes">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Media</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sessions logged</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="max-w-64">
                        <span className="text-ink block truncate font-medium">
                          {program.title}
                        </span>
                        <span className="text-ink-subtle block truncate text-xs">
                          /{program.slug}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {humaniseEnum(program.category)}
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        {humaniseEnum(program.difficulty)}
                      </TableCell>
                      <TableCell className="tabular text-right whitespace-nowrap">
                        {formatDuration(program.durationMinutes)}
                      </TableCell>
                      <TableCell className="text-ink-muted text-xs">
                        {[program.videoUrl ? "Video" : null, program.imageUrl ? "Image" : null]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            program.status === "PUBLISHED"
                              ? "success"
                              : program.status === "DRAFT"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {humaniseEnum(program.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(program._count.logs)}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {formatDate(program.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>

            <div className="border-line border-t px-4 py-3">
              <Pagination pagination={pagination} />
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}
